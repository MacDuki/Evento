import { evaluateConsumption, validateCycleDefinition, validateGoal } from "../../domain/cycle.js";
import { addCalendarDays, calendarDaysBetween, daysSince, isValidDateOnly, localDate } from "../../domain/dates.js";
import type { AppState, Contact, Cycle, CycleGoal, Soul } from "../types.js";

const DB_NAME = "en-calma";
const DB_VERSION = 1;
const STORE_NAME = "state";
const RECORD_KEY = "app";
const MIRROR_KEY = "en-calma-state-v1";
const MIGRATION_FLAG = "en-calma-legacy-migration-checked";

export type LocalSnapshot = {
  format: "en-calma";
  version: 1;
  profileId: string;
  createdAt: string;
  updatedAt: string;
  souls: Soul[];
  contacts: Contact[];
};

export type LocalAppState = AppState & { profileId: string };

export type ConsumptionResult = {
  state: LocalAppState;
  cleanDays: number;
  soulStatus: "alive" | "dead";
  nextMinCleanDays: number | null;
  nextGoalDays: number | null;
};

const nowIso = () => new Date().toISOString();
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const asString = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const asNumber = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const optionalNumber = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

let database: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador no permite IndexedDB"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        database = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      database = null;
      reject(request.error ?? new Error("No se pudo abrir el almacenamiento local"));
    };
    request.onblocked = () => {
      database = null;
      reject(new Error("El almacenamiento local está bloqueado. Cerrá otras pestañas de la app."));
    };
  });
  return database;
}

async function readDatabase(): Promise<unknown | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(RECORD_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error("No se pudo leer el almacenamiento local"));
  });
}

async function writeDatabase(value: LocalSnapshot): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("No se pudo guardar el progreso"));
    tx.onabort = () => reject(tx.error ?? new Error("No se pudo guardar el progreso"));
  });
}

function readMirror(): unknown | null {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    return raw ? JSON.parse(raw) as unknown : null;
  } catch {
    return null;
  }
}

function writeMirror(value: LocalSnapshot): boolean {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function snapshotTime(value: unknown): number {
  if (!isRecord(value)) return 0;
  const time = Date.parse(asString(value.updatedAt));
  return Number.isFinite(time) ? time : 0;
}

async function readSnapshotRaw(): Promise<unknown | null> {
  const mirror = readMirror();
  const mirrorValid = isRecord(mirror) && Array.isArray(mirror.souls);
  try {
    const value = await readDatabase();
    if (value && mirrorValid && snapshotTime(mirror) > snapshotTime(value)) return mirror;
    if (value) return value;
  } catch {
    // El espejo en localStorage permite seguir funcionando si IndexedDB no está disponible.
  }
  return mirror;
}

async function persist(snapshot: LocalSnapshot): Promise<void> {
  snapshot.updatedAt = nowIso();
  let stored = false;
  try {
    await writeDatabase(snapshot);
    stored = true;
  } catch {
    // Se intenta el espejo antes de fallar.
  }
  if (writeMirror(snapshot)) stored = true;
  if (!stored) throw new Error("No se pudo guardar el progreso en este navegador");
}

function parseGoals(value: unknown): CycleGoal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(goal => {
    if (!isRecord(goal)) return [];
    const days = Math.round(asNumber(goal.days));
    const createdAt = asString(goal.createdAt);
    if (days <= 0 || !createdAt) return [];
    return [{ days, createdAt }];
  });
}

function parseCycle(value: unknown): Cycle {
  if (!isRecord(value)) throw new Error("El respaldo contiene un ciclo inválido");
  const startDate = asString(value.startDate);
  if (!isValidDateOnly(startDate)) throw new Error("El respaldo contiene una fecha inválida");
  const status = value.status === "completed" || value.status === "failed" ? value.status : "active";
  const goals = parseGoals(value.goals);
  const fallbackGoal = optionalNumber(value.goalDays);
  const goalDays = goals.at(-1)?.days ?? (fallbackGoal !== null && fallbackGoal > 0 ? Math.round(fallbackGoal) : null);
  const id = asString(value.id) || makeId();
  const cycleNumber = Math.max(1, Math.round(asNumber(value.cycleNumber, 1)));
  const minCleanDays = Math.max(1, Math.round(asNumber(value.minCleanDays, 1)));
  return {
    id,
    cycleNumber,
    minCleanDays,
    startDate,
    status,
    finalCleanDays: status === "active" ? null : Math.max(0, Math.round(asNumber(value.finalCleanDays, 0))),
    deficitDays: Math.max(0, Math.round(asNumber(value.deficitDays, 0))),
    endReason: typeof value.endReason === "string" ? value.endReason : null,
    endedAt: typeof value.endedAt === "string" ? value.endedAt : null,
    nextCycleId: typeof value.nextCycleId === "string" ? value.nextCycleId : null,
    plannedEndDate: goalDays === null ? null : addCalendarDays(startDate, goalDays),
    goalDays,
    goals,
    cleanDays: 0
  };
}

function parseSoul(value: unknown): Soul {
  if (!isRecord(value)) throw new Error("El respaldo contiene una soul inválida");
  const name = asString(value.name).trim();
  if (!name) throw new Error("El respaldo contiene una soul sin nombre");
  const cycles = Array.isArray(value.cycles) ? value.cycles.map(parseCycle) : [];
  if (cycles.length === 0) throw new Error(`La soul ${name} no tiene ciclos`);
  const status = value.status === "dead" ? "dead" : "alive";
  const activeCycles = cycles.filter(cycle => cycle.status === "active");
  if (activeCycles.length > 1) throw new Error(`La soul ${name} tiene más de un ciclo activo`);
  if (status === "alive" && activeCycles.length === 0) throw new Error(`La soul ${name} no tiene un ciclo activo`);
  const maxPurityDays = Math.max(0, Math.round(asNumber(value.maxPurityDays, 0)));
  return {
    id: asString(value.id) || makeId(),
    name,
    status,
    maxPurityDays,
    storedMaxPurityDays: Math.max(maxPurityDays, Math.round(asNumber(value.storedMaxPurityDays, maxPurityDays))),
    createdAt: asString(value.createdAt) || nowIso(),
    diedAt: typeof value.diedAt === "string" ? value.diedAt : null,
    cycles
  };
}

function parseContact(value: unknown): Contact {
  if (!isRecord(value)) throw new Error("El respaldo contiene un contacto inválido");
  const name = asString(value.contact_name).trim();
  const email = asString(value.contact_email).trim();
  if (!name || !email) throw new Error("El respaldo contiene un contacto incompleto");
  return { id: asString(value.id) || makeId(), contact_name: name, contact_email: email };
}

function parseSnapshot(value: unknown): LocalSnapshot {
  if (!isRecord(value)) throw new Error("El archivo no es un respaldo válido");
  const source = isRecord(value.data) ? value.data : value;
  if (!Array.isArray(source.souls) || !Array.isArray(source.contacts)) {
    throw new Error("El archivo no contiene souls y contactos válidos");
  }
  const souls = source.souls.map(parseSoul);
  if (souls.filter(soul => soul.status === "alive").length > 1) {
    throw new Error("El respaldo tiene más de una soul viva");
  }
  const profile = isRecord(source.profile) ? source.profile : null;
  return {
    format: "en-calma",
    version: 1,
    profileId: asString(source.profileId) || asString(profile?.id) || makeId(),
    createdAt: asString(source.createdAt) || nowIso(),
    updatedAt: nowIso(),
    souls,
    contacts: source.contacts.map(parseContact)
  };
}

function buildState(snapshot: LocalSnapshot): LocalAppState {
  const today = localDate();
  const souls = snapshot.souls.map(soul => {
    const cycles = soul.cycles.map(cycle => {
      const goalDays = cycle.goals.at(-1)?.days ?? cycle.goalDays ?? null;
      const cleanDays = cycle.status === "active" ? daysSince(cycle.startDate, today) : cycle.finalCleanDays ?? cycle.cleanDays ?? 0;
      return {
        ...cycle,
        cleanDays,
        goalDays,
        plannedEndDate: goalDays === null ? null : addCalendarDays(cycle.startDate, goalDays)
      };
    }).sort((a, b) => b.cycleNumber - a.cycleNumber);
    const activeCycle = cycles.find(cycle => cycle.status === "active");
    const storedMaxPurityDays = Math.max(soul.storedMaxPurityDays ?? soul.maxPurityDays, soul.maxPurityDays);
    return {
      ...soul,
      cycles,
      storedMaxPurityDays,
      maxPurityDays: Math.max(storedMaxPurityDays, activeCycle?.cleanDays ?? 0)
    };
  }).sort((a, b) => {
    if (a.status !== b.status) return a.status === "alive" ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return {
    profileId: snapshot.profileId,
    today,
    soul: souls.find(soul => soul.status === "alive") ?? null,
    souls,
    contacts: snapshot.contacts
  };
}

async function readSnapshot(): Promise<LocalSnapshot> {
  const raw = await readSnapshotRaw();
  if (!raw) throw new Error("No hay un perfil local. Entrá de nuevo.");
  return parseSnapshot(raw);
}

async function saveAndBuild(snapshot: LocalSnapshot): Promise<LocalAppState> {
  await persist(snapshot);
  return buildState(snapshot);
}

function findCycle(snapshot: LocalSnapshot, cycleId: string): { soul: Soul; cycle: Cycle } | null {
  for (const soul of snapshot.souls) {
    const cycle = soul.cycles.find(item => item.id === cycleId);
    if (cycle) return { soul, cycle };
  }
  return null;
}

export async function getState(): Promise<LocalAppState | null> {
  const raw = await readSnapshotRaw();
  return raw ? buildState(parseSnapshot(raw)) : null;
}

export async function createProfile(): Promise<string> {
  const raw = await readSnapshotRaw();
  if (raw) return parseSnapshot(raw).profileId;
  const now = nowIso();
  const snapshot: LocalSnapshot = {
    format: "en-calma",
    version: 1,
    profileId: makeId(),
    createdAt: now,
    updatedAt: now,
    souls: [],
    contacts: []
  };
  await persist(snapshot);
  return snapshot.profileId;
}

export async function createSoul(input: {
  name: string;
  minCleanDays: number;
  goalDays: number | null;
  startDate: string;
}): Promise<LocalAppState> {
  const snapshot = await readSnapshot();
  const name = input.name.trim();
  if (!name) throw new Error("El nombre es obligatorio");
  if (name.length > 40) throw new Error("El nombre no puede superar 40 caracteres");
  validateCycleDefinition(input.minCleanDays, input.goalDays);
  if (!isValidDateOnly(input.startDate)) throw new Error("La fecha de inicio no es válida");
  if (input.startDate > localDate()) throw new Error("La fecha de inicio no puede ser futura");
  if (snapshot.souls.some(soul => soul.status === "alive")) {
    throw new Error("Ya tenés una soul viva. Solo puede haber una a la vez.");
  }

  const now = nowIso();
  const soulId = makeId();
  const cycleId = makeId();
  const goals = input.goalDays === null ? [] : [{ days: input.goalDays, createdAt: now }];
  const cycle: Cycle = {
    id: cycleId,
    cycleNumber: 1,
    minCleanDays: input.minCleanDays,
    startDate: input.startDate,
    status: "active",
    finalCleanDays: null,
    deficitDays: 0,
    endReason: null,
    endedAt: null,
    nextCycleId: null,
    plannedEndDate: input.goalDays === null ? null : addCalendarDays(input.startDate, input.goalDays),
    goalDays: input.goalDays,
    goals,
    cleanDays: 0
  };
  snapshot.souls.push({
    id: soulId,
    name,
    status: "alive",
    maxPurityDays: 0,
    storedMaxPurityDays: 0,
    createdAt: now,
    diedAt: null,
    cycles: [cycle]
  });
  return saveAndBuild(snapshot);
}

export async function renameSoul(soulId: string, value: string): Promise<LocalAppState> {
  const snapshot = await readSnapshot();
  const name = value.trim();
  if (!name) throw new Error("El nombre es obligatorio");
  if (name.length > 40) throw new Error("El nombre no puede superar 40 caracteres");
  const soul = snapshot.souls.find(item => item.id === soulId);
  if (!soul) throw new Error("Soul no encontrada");
  if (soul.status !== "alive") throw new Error("La soul muerta no puede renombrarse");
  soul.name = name;
  return saveAndBuild(snapshot);
}

export async function setGoal(cycleId: string, goalDays: number): Promise<LocalAppState> {
  const snapshot = await readSnapshot();
  const found = findCycle(snapshot, cycleId);
  if (!found) throw new Error("Ciclo no encontrado");
  const { soul, cycle } = found;
  if (soul.status !== "alive") throw new Error("La soul ya no está viva");
  if (cycle.status !== "active") throw new Error("El ciclo no está activo");
  const currentGoalDays = cycle.goals.at(-1)?.days ?? cycle.goalDays ?? null;
  const cleanDays = daysSince(cycle.startDate, localDate());
  validateGoal({
    minCleanDays: cycle.minCleanDays,
    currentGoalDays,
    cleanDays,
    newGoalDays: goalDays
  });
  const now = nowIso();
  cycle.goals.push({ days: goalDays, createdAt: now });
  cycle.goalDays = goalDays;
  cycle.plannedEndDate = addCalendarDays(cycle.startDate, goalDays);
  return saveAndBuild(snapshot);
}

export async function admitConsumption(cycleId: string, eventDate: string, nextGoalAdditionalDays?: number): Promise<ConsumptionResult> {
  const snapshot = await readSnapshot();
  const found = findCycle(snapshot, cycleId);
  if (!found) throw new Error("Ciclo activo no encontrado");
  const { soul, cycle } = found;
  if (soul.status !== "alive") throw new Error("La soul ya no está viva");
  if (cycle.status !== "active") throw new Error("El ciclo no está activo");
  if (!isValidDateOnly(eventDate)) throw new Error("La fecha del consumo no es válida");
  const today = localDate();
  if (eventDate > today) throw new Error("La fecha del consumo no puede ser futura");
  if (eventDate < cycle.startDate) throw new Error("La fecha del consumo no puede ser anterior al inicio del ciclo");
  if (nextGoalAdditionalDays !== undefined && (!Number.isInteger(nextGoalAdditionalDays) || nextGoalAdditionalDays < 0)) {
    throw new Error("La amplitud debe ser un entero no negativo");
  }

  const cleanDays = calendarDaysBetween(cycle.startDate, eventDate);
  const targetGoalDays = cycle.goals.at(-1)?.days ?? cycle.goalDays ?? null;
  const outcome = evaluateConsumption({
    minCleanDays: cycle.minCleanDays,
    targetGoalDays,
    cleanDays
  });
  soul.maxPurityDays = Math.max(soul.maxPurityDays, cleanDays);
  soul.storedMaxPurityDays = soul.maxPurityDays;
  const now = nowIso();
  cycle.finalCleanDays = cleanDays;
  cycle.deficitDays = outcome.deficitDays;
  cycle.endReason = "consumption";
  cycle.endedAt = eventDate;
  cycle.cleanDays = cleanDays;

  if (outcome.soulDies) {
    soul.status = "dead";
    soul.diedAt = eventDate;
    cycle.status = "failed";
    await persist(snapshot);
    return {
      state: buildState(snapshot),
      cleanDays,
      soulStatus: "dead",
      nextMinCleanDays: null,
      nextGoalDays: null
    };
  }

  cycle.status = "completed";
  const nextMinCleanDays = outcome.nextMinCleanDays ?? cleanDays + 1;
  const additionalDays = nextGoalAdditionalDays ?? 0;
  const nextGoalDays = additionalDays > 0 ? nextMinCleanDays + additionalDays : null;
  const nextCycleId = makeId();
  const nextCycle: Cycle = {
    id: nextCycleId,
    cycleNumber: cycle.cycleNumber + 1,
    minCleanDays: nextMinCleanDays,
    startDate: eventDate,
    status: "active",
    finalCleanDays: null,
    deficitDays: 0,
    endReason: null,
    endedAt: null,
    nextCycleId: null,
    plannedEndDate: nextGoalDays === null ? null : addCalendarDays(eventDate, nextGoalDays),
    goalDays: nextGoalDays,
    goals: nextGoalDays === null ? [] : [{ days: nextGoalDays, createdAt: now }],
    cleanDays: 0
  };
  cycle.nextCycleId = nextCycleId;
  soul.cycles.push(nextCycle);
  await persist(snapshot);
  return {
    state: buildState(snapshot),
    cleanDays,
    soulStatus: "alive",
    nextMinCleanDays,
    nextGoalDays
  };
}

export async function addContact(name: string, email: string): Promise<LocalAppState> {
  const snapshot = await readSnapshot();
  const contactName = name.trim();
  const contactEmail = email.trim();
  if (!contactName) throw new Error("El nombre es obligatorio");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new Error("Usá un correo válido");
  snapshot.contacts.push({ id: makeId(), contact_name: contactName, contact_email: contactEmail });
  return saveAndBuild(snapshot);
}

export async function exportSnapshot(): Promise<LocalSnapshot | null> {
  const raw = await readSnapshotRaw();
  return raw ? parseSnapshot(raw) : null;
}

export async function importSnapshot(value: unknown): Promise<LocalAppState> {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      throw new Error("El archivo no es un JSON válido");
    }
  }
  const snapshot = parseSnapshot(parsed);
  await persist(snapshot);
  return buildState(snapshot);
}

export async function deleteAllLocalData(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // El espejo local se elimina de todos modos.
  }
  try {
    localStorage.removeItem(MIRROR_KEY);
    sessionStorage.removeItem(MIGRATION_FLAG);
  } catch {
    // Sin almacenamiento disponible no hay nada más que limpiar.
  }
}

export async function migrateLegacyServerState(legacyUserId: string): Promise<boolean> {
  if (!legacyUserId) return false;
  try {
    if (sessionStorage.getItem(MIGRATION_FLAG) === "true") return false;
  } catch {
    // Se intenta igualmente.
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch("/api/state", { headers: { "x-user-id": legacyUserId }, signal: controller.signal });
    if (!response.ok) return false;
    const data = await response.json() as unknown;
    if (!isRecord(data) || !Array.isArray(data.souls)) return false;
    const snapshot = parseSnapshot({
      format: "en-calma",
      version: 1,
      profileId: legacyUserId,
      createdAt: nowIso(),
      souls: data.souls,
      contacts: data.contacts ?? []
    });
    await persist(snapshot);
    localStorage.removeItem("userId");
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
    try {
      sessionStorage.setItem(MIGRATION_FLAG, "true");
    } catch {
      // Sin sessionStorage no hay marca que guardar.
    }
  }
}
