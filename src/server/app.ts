import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "./db.js";
import { coachReflection, notifyContacts } from "./services.js";
import { evaluateConsumption, validateCycleDefinition, validateGoal, type ConsumptionOutcome } from "../domain/cycle.js";
import { addCalendarDays, calendarDaysBetween, daysSince, isValidDateOnly, localDate } from "../domain/dates.js";

const app = express();
app.use(cors());
app.use(express.json());

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const userId = (req: express.Request) => String(req.header("x-user-id") || "");

function requireUser(req: express.Request, res: express.Response): string | null {
  const value = userId(req);
  if (!value) {
    res.status(401).json({ error: "Falta x-user-id" });
    return null;
  }
  return value;
}

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha válida (AAAA-MM-DD)");
const firstIssue = (error: z.ZodError) => error.issues[0]?.message || "Datos inválidos";

type CycleRow = {
  id: string;
  soul_id: string;
  cycle_number: number;
  min_clean_days: number;
  start_date: string;
  status: "active" | "completed" | "failed";
  final_clean_days: number | null;
  deficit_days: number;
  end_reason: string | null;
  ended_at: string | null;
  next_cycle_id: string | null;
  created_at: string;
};

type SoulRow = {
  id: string;
  user_id: string;
  name: string;
  status: "alive" | "dead";
  max_purity_days: number;
  created_at: string;
  died_at: string | null;
};

type GoalRow = { goal_days: number; created_at: string };

const goalsFor = (cycleId: string) =>
  db.prepare("SELECT goal_days, created_at FROM cycle_goals WHERE cycle_id=? ORDER BY created_at ASC, rowid ASC").all(cycleId) as GoalRow[];

const latestGoal = (cycleId: string): number | null => {
  const row = db.prepare("SELECT goal_days FROM cycle_goals WHERE cycle_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(cycleId) as { goal_days: number } | undefined;
  return row?.goal_days ?? null;
};

const mapCycle = (row: CycleRow, today: string) => {
  const goals = goalsFor(row.id);
  const goalDays = goals.at(-1)?.goal_days ?? null;
  const cleanDays = row.status === "active" ? daysSince(row.start_date, today) : row.final_clean_days ?? 0;
  return {
    id: row.id,
    cycleNumber: row.cycle_number,
    minCleanDays: row.min_clean_days,
    startDate: row.start_date,
    status: row.status,
    finalCleanDays: row.final_clean_days,
    deficitDays: row.deficit_days,
    endReason: row.end_reason,
    endedAt: row.ended_at,
    nextCycleId: row.next_cycle_id,
    plannedEndDate: goalDays === null ? null : addCalendarDays(row.start_date, goalDays),
    goalDays,
    goals: goals.map(goal => ({ days: goal.goal_days, createdAt: goal.created_at })),
    cleanDays
  };
};

const mapSoul = (row: SoulRow, today: string) => {
  const cycleRows = db.prepare("SELECT * FROM cycles WHERE soul_id=? ORDER BY cycle_number DESC").all(row.id) as CycleRow[];
  const cycles = cycleRows.map(cycle => mapCycle(cycle, today));
  const activeCycle = cycles.find(cycle => cycle.status === "active");
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    maxPurityDays: Math.max(row.max_purity_days, activeCycle?.cleanDays ?? 0),
    storedMaxPurityDays: row.max_purity_days,
    createdAt: row.created_at,
    diedAt: row.died_at,
    cycles
  };
};

const loadSouls = (uid: string, today: string) => {
  const rows = db.prepare("SELECT * FROM souls WHERE user_id=? ORDER BY CASE WHEN status='alive' THEN 0 ELSE 1 END, created_at DESC").all(uid) as SoulRow[];
  return rows.map(row => mapSoul(row, today));
};

const logEvent = (value: { userId: string; soulId?: string; cycleId?: string; type: string; eventDate?: string; reflection?: string; feedback?: string }) => {
  db.prepare("INSERT INTO events_log (id,user_id,soul_id,cycle_id,event_type,reflection_text,ai_feedback,event_date,created_at) VALUES (@id,@user_id,@soul_id,@cycle_id,@event_type,@reflection_text,@ai_feedback,@event_date,@created_at)")
    .run({
      id: id(),
      user_id: value.userId,
      soul_id: value.soulId ?? null,
      cycle_id: value.cycleId ?? null,
      event_type: value.type,
      reflection_text: value.reflection ?? null,
      ai_feedback: value.feedback ?? null,
      event_date: value.eventDate ?? localDate(),
      created_at: now()
    });
};

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/users", (req, res) => {
  const parsed = z.object({ email: z.string().email().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
  const user = { id: id(), email: parsed.data.email || null, password_hash: null, created_at: now() };
  db.prepare("INSERT INTO users (id,email,password_hash,created_at) VALUES (@id,@email,@password_hash,@created_at)").run(user);
  res.status(201).json(user);
});

app.delete("/api/users/me", (req, res) => {
  const uid = requireUser(req, res);
  if (!uid) return;
  const result = db.prepare("DELETE FROM users WHERE id=?").run(uid);
  if (result.changes === 0) return res.status(404).json({ error: "Usuario no encontrado" });
  res.status(204).end();
});

app.get("/api/state", (req, res) => {
  const uid = requireUser(req, res);
  if (!uid) return;
  const user = db.prepare("SELECT id FROM users WHERE id=?").get(uid);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  const today = localDate();
  const souls = loadSouls(uid, today);
  const soul = souls.find(item => item.status === "alive") ?? null;
  const contacts = db.prepare("SELECT id,contact_name,contact_email FROM accountability_contacts WHERE user_id=?").all(uid);
  res.json({ today, soul, souls, contacts });
});

app.post("/api/souls", (req, res) => {
  const uid = requireUser(req, res);
  if (!uid) return;
  const parsed = z.object({
    name: z.string().trim().min(1, "El nombre es obligatorio").max(40, "El nombre no puede superar 40 caracteres"),
    minCleanDays: z.number().int().positive("El mínimo debe ser mayor que cero"),
    goalDays: z.number().int().positive("La meta debe ser mayor que cero").nullable().optional(),
    startDate: dateOnly.optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });

  const startDate = parsed.data.startDate ?? localDate();
  const today = localDate();
  if (!isValidDateOnly(startDate)) return res.status(400).json({ error: "La fecha de inicio no es válida" });
  if (startDate > today) return res.status(400).json({ error: "La fecha de inicio no puede ser futura" });

  const goalDays = parsed.data.goalDays ?? null;
  try {
    validateCycleDefinition(parsed.data.minCleanDays, goalDays);
  } catch (error) {
    return res.status(422).json({ error: error instanceof Error ? error.message : "Ciclo inválido" });
  }

  if (db.prepare("SELECT 1 FROM souls WHERE user_id=? AND status='alive'").get(uid)) {
    return res.status(409).json({ error: "Ya tenés una soul viva. Solo puede haber una a la vez." });
  }

  try {
    const soulId = id();
    const cycleId = id();
    db.transaction(() => {
      db.prepare("INSERT INTO souls (id,user_id,name,status,max_purity_days,created_at) VALUES (?,?,?,?,?,?)")
        .run(soulId, uid, parsed.data.name, "alive", 0, now());
      db.prepare("INSERT INTO cycles (id,soul_id,cycle_number,min_clean_days,start_date,status,final_clean_days,deficit_days,end_reason,ended_at,next_cycle_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(cycleId, soulId, 1, parsed.data.minCleanDays, startDate, "active", null, 0, null, null, null, now());
      if (goalDays !== null) {
        db.prepare("INSERT INTO cycle_goals (id,cycle_id,goal_days,created_at) VALUES (?,?,?,?)").run(id(), cycleId, goalDays, now());
      }
      logEvent({ userId: uid, soulId, cycleId, type: "soul_created", eventDate: startDate });
    })();
    const soul = mapSoul(db.prepare("SELECT * FROM souls WHERE id=?").get(soulId) as SoulRow, today);
    res.status(201).json({ soul });
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: souls\.user_id/.test(error.message)) {
      return res.status(409).json({ error: "Ya tenés una soul viva. Solo puede haber una a la vez." });
    }
    return res.status(422).json({ error: error instanceof Error ? error.message : "No se pudo crear la soul" });
  }
});

app.get("/api/souls/:soulId", (req, res) => {
  const uid = requireUser(req, res);
  if (!uid) return;
  const row = db.prepare("SELECT * FROM souls WHERE id=? AND user_id=?").get(req.params.soulId, uid) as SoulRow | undefined;
  if (!row) return res.status(404).json({ error: "Soul no encontrada" });
  res.json({ soul: mapSoul(row, localDate()) });
});

app.post("/api/souls/:soulId/name", (req, res) => {
  const uid = requireUser(req, res);
  if (!uid) return;
  const parsed = z.object({ name: z.string().trim().min(1, "El nombre es obligatorio").max(40, "El nombre no puede superar 40 caracteres") }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
  const soul = db.prepare("SELECT * FROM souls WHERE id=? AND user_id=?").get(req.params.soulId, uid) as SoulRow | undefined;
  if (!soul) return res.status(404).json({ error: "Soul no encontrada" });
  if (soul.status !== "alive") return res.status(422).json({ error: "La soul muerta no puede renombrarse" });
  db.transaction(() => {
    db.prepare("UPDATE souls SET name=? WHERE id=?").run(parsed.data.name, soul.id);
    logEvent({ userId: uid, soulId: soul.id, type: "soul_renamed" });
  })();
  res.json({ id: soul.id, name: parsed.data.name });
});

app.post("/api/cycles/:cycleId/goal", (req, res) => {
  const uid = requireUser(req, res);
  if (!uid) return;
  const parsed = z.object({ goalDays: z.number().int().positive("La meta debe ser mayor que cero") }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });

  const cycle = db.prepare("SELECT c.*, s.user_id, s.status AS soul_status FROM cycles c JOIN souls s ON s.id=c.soul_id WHERE c.id=? AND s.user_id=?")
    .get(req.params.cycleId, uid) as (CycleRow & { user_id: string; soul_status: string }) | undefined;
  if (!cycle) return res.status(404).json({ error: "Ciclo no encontrado" });
  if (cycle.soul_status !== "alive") return res.status(422).json({ error: "La soul ya no está viva" });
  if (cycle.status !== "active") return res.status(422).json({ error: "El ciclo no está activo" });

  const today = localDate();
  const cleanDays = daysSince(cycle.start_date, today);
  try {
    validateGoal({
      minCleanDays: cycle.min_clean_days,
      currentGoalDays: latestGoal(cycle.id),
      cleanDays,
      newGoalDays: parsed.data.goalDays
    });
  } catch (error) {
    return res.status(422).json({ error: error instanceof Error ? error.message : "Meta inválida" });
  }

  try {
    db.transaction(() => {
      db.prepare("INSERT INTO cycle_goals (id,cycle_id,goal_days,created_at) VALUES (?,?,?,?)").run(id(), cycle.id, parsed.data.goalDays, now());
      logEvent({ userId: uid, soulId: cycle.soul_id, cycleId: cycle.id, type: "goal_set", eventDate: today });
    })();
    const updated = mapSoul(db.prepare("SELECT * FROM souls WHERE id=?").get(cycle.soul_id) as SoulRow, today);
    res.json({ goalDays: parsed.data.goalDays, soul: updated });
  } catch (error) {
    res.status(422).json({ error: error instanceof Error ? error.message : "No se pudo guardar la meta" });
  }
});

app.post("/api/cycles/:cycleId/admit-consumption", async (req, res) => {
  const uid = requireUser(req, res);
  if (!uid) return;
  const parsed = z.object({
    eventDate: dateOnly,
    nextGoalAdditionalDays: z.number().int().min(0, "La amplitud no puede ser negativa").max(36500, "La amplitud es demasiado grande").optional().nullable()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });

  const cycle = db.prepare("SELECT c.*, s.user_id, s.status AS soul_status FROM cycles c JOIN souls s ON s.id=c.soul_id WHERE c.id=? AND s.user_id=?")
    .get(req.params.cycleId, uid) as (CycleRow & { user_id: string; soul_status: string }) | undefined;
  if (!cycle) return res.status(404).json({ error: "Ciclo activo no encontrado" });
  if (cycle.soul_status !== "alive") return res.status(422).json({ error: "La soul ya no está viva" });
  if (cycle.status !== "active") return res.status(422).json({ error: "El ciclo no está activo" });

  const today = localDate();
  if (!isValidDateOnly(parsed.data.eventDate)) return res.status(400).json({ error: "La fecha del consumo no es válida" });
  if (parsed.data.eventDate > today) return res.status(400).json({ error: "La fecha del consumo no puede ser futura" });
  if (parsed.data.eventDate < cycle.start_date) return res.status(400).json({ error: "La fecha del consumo no puede ser anterior al inicio del ciclo" });

  const cleanDays = calendarDaysBetween(cycle.start_date, parsed.data.eventDate);
  let outcome: ConsumptionOutcome;
  try {
    outcome = evaluateConsumption({
      minCleanDays: cycle.min_clean_days,
      targetGoalDays: latestGoal(cycle.id),
      cleanDays
    });
  } catch (error) {
    return res.status(422).json({ error: error instanceof Error ? error.message : "Consumo inválido" });
  }

  const nextMin = outcome.nextMinCleanDays ?? cleanDays + 1;
  const additionalDays = parsed.data.nextGoalAdditionalDays ?? 0;
  const nextGoalDays = nextMin + additionalDays;
  const nextCycleId = id();

  try {
    db.transaction(() => {
      db.prepare("UPDATE souls SET max_purity_days=MAX(max_purity_days, ?) WHERE id=?").run(cleanDays, cycle.soul_id);
      logEvent({ userId: uid, soulId: cycle.soul_id, cycleId: cycle.id, type: "consumption_admitted", eventDate: parsed.data.eventDate });
      if (outcome.soulDies) {
        db.prepare("UPDATE souls SET status='dead', died_at=? WHERE id=?").run(parsed.data.eventDate, cycle.soul_id);
        db.prepare("UPDATE cycles SET status='failed', final_clean_days=?, deficit_days=?, end_reason='consumption', ended_at=? WHERE id=?")
          .run(cleanDays, outcome.deficitDays, parsed.data.eventDate, cycle.id);
        logEvent({ userId: uid, soulId: cycle.soul_id, cycleId: cycle.id, type: "soul_died", eventDate: parsed.data.eventDate });
      } else {
        db.prepare("UPDATE cycles SET status='completed', final_clean_days=?, deficit_days=?, end_reason='consumption', ended_at=? WHERE id=?")
          .run(cleanDays, outcome.deficitDays, parsed.data.eventDate, cycle.id);
        db.prepare("INSERT INTO cycles (id,soul_id,cycle_number,min_clean_days,start_date,status,final_clean_days,deficit_days,end_reason,ended_at,next_cycle_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
          .run(nextCycleId, cycle.soul_id, cycle.cycle_number + 1, nextMin, parsed.data.eventDate, "active", null, 0, null, null, null, now());
        db.prepare("UPDATE cycles SET next_cycle_id=? WHERE id=?").run(nextCycleId, cycle.id);
        if (additionalDays > 0) {
          db.prepare("INSERT INTO cycle_goals (id,cycle_id,goal_days,created_at) VALUES (?,?,?,?)").run(id(), nextCycleId, nextGoalDays, now());
        }
        logEvent({ userId: uid, soulId: cycle.soul_id, cycleId: nextCycleId, type: "cycle_started", eventDate: parsed.data.eventDate });
      }
    })();
  } catch (error) {
    return res.status(422).json({ error: error instanceof Error ? error.message : "No se pudo registrar el consumo" });
  }

  let notificationError = false;
  if (outcome.soulDies) {
    const recipients = (db.prepare("SELECT contact_email FROM accountability_contacts WHERE user_id=?").all(uid) as { contact_email: string }[]).map(contact => contact.contact_email);
    try {
      await notifyContacts("Consumo admitido", "La soul ha muerto y su memoria se conserva.", recipients);
    } catch (error) {
      notificationError = true;
      console.error("No se pudo notificar el consumo admitido", error);
    }
  }

  res.json({
    ok: true,
    cleanDays,
    status: outcome.status,
    soulStatus: outcome.soulDies ? "dead" : "alive",
    deficitDays: outcome.deficitDays,
    nextMinCleanDays: outcome.soulDies ? null : nextMin,
    nextCycleId: outcome.soulDies ? null : nextCycleId,
    nextGoalDays: outcome.soulDies || additionalDays === 0 ? null : nextGoalDays,
    notificationError
  });
});

app.post("/api/coach/reflection", async (req, res) => {
  const uid = requireUser(req, res);
  if (!uid) return;
  const parsed = z.object({ cycleId: z.string().optional(), reflection: z.string().min(1, "Escribí una reflexión").max(10000, "Máximo 10.000 caracteres") }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });

  let soulId: string | undefined;
  if (parsed.data.cycleId) {
    const owner = db.prepare("SELECT c.soul_id FROM cycles c JOIN souls s ON s.id=c.soul_id WHERE c.id=? AND s.user_id=?").get(parsed.data.cycleId, uid) as { soul_id: string } | undefined;
    if (!owner) return res.status(404).json({ error: "Ciclo no encontrado" });
    soulId = owner.soul_id;
  }

  try {
    const feedback = await coachReflection(parsed.data.reflection);
    logEvent({
      userId: uid,
      soulId,
      cycleId: parsed.data.cycleId,
      type: "reflection",
      reflection: parsed.data.reflection,
      feedback
    });
    res.json({ feedback });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "No se pudo consultar al coach" });
  }
});

app.post("/api/contacts", (req, res) => {
  const uid = requireUser(req, res);
  if (!uid) return;
  const parsed = z.object({ name: z.string().trim().min(1, "El nombre es obligatorio"), email: z.string().trim().email("Usá un correo válido") }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
  const contact = { id: id(), user_id: uid, contact_name: parsed.data.name, contact_email: parsed.data.email, created_at: now() };
  db.prepare("INSERT INTO accountability_contacts (id,user_id,contact_name,contact_email,created_at) VALUES (@id,@user_id,@contact_name,@contact_email,@created_at)").run(contact);
  res.status(201).json(contact);
});

export default app;
