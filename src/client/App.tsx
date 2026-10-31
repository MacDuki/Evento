import {
  AlertTriangle, ArrowUpRight, CalendarDays, Check, CheckCircle2, CircleDashed,
  CircleX, Edit3, ImagePlus, LoaderCircle, Mail, Plus, RotateCcw,
  Send, Sparkles, Trash2, Trophy, UserRound, Users, X
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NoSoul, EmptySoulOrb } from "./components/common/EmptySoul.js";
import { Navigation } from "./components/layout/Navigation.js";
import { defaultOrbSettings, statusLabels } from "./constants/app.js";
import { CycleOnboarding } from "./pages/Onboarding/CycleOnboarding.js";
import { Soul, SoulCustomizer, SoulMemory } from "./pages/Soul/Soul.js";
import { api, isQueued } from "./services/api.js";
import type { AppState, Contact, Cycle, OrbSettings, Soul as SoulType, SoulReaction, View } from "./types.js";
import { formatDate, today } from "./utils/dates.js";

export function App() {
  const [userId, setUserId] = useState(localStorage.getItem("userId") || "");
  const [isLoading, setIsLoading] = useState(Boolean(localStorage.getItem("userId")));
  const [stateError, setStateError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [soul, setSoul] = useState<SoulType | null>(null);
  const [souls, setSouls] = useState<SoulType[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [view, setView] = useState<View>("dashboard");
  const [min, setMin] = useState("1");
  const [goal, setGoalInput] = useState("");
  const [soulName, setSoulName] = useState("");
  const [startMode, setStartMode] = useState<"now" | "past">("now");
  const [startDate, setStartDate] = useState(today);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error" | "info">("success");
  const [consumptionDate, setConsumptionDate] = useState(today);
  const [nextAdditionalDays, setNextAdditionalDays] = useState("");
  const consumptionDateInputRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState<"consumption" | "delete" | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalInput, setNewGoalInput] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [onboarding, setOnboarding] = useState(false);
  const [reflection, setReflection] = useState("");
  const [feedback, setFeedback] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem("abstinencia-profile-photo") || "");
  const [soulReaction, setSoulReaction] = useState<SoulReaction>("idle");
  const [orbSettings, setOrbSettings] = useState<OrbSettings>(() => {
    try {
      const saved = localStorage.getItem("soul-orb-settings");
      return saved ? { ...defaultOrbSettings, ...JSON.parse(saved) } : defaultOrbSettings;
    } catch { return defaultOrbSettings; }
  });

  const activeSoul = soul;
  const activeCycle = useMemo(() => activeSoul?.cycles.find(cycle => cycle.status === "active") ?? null, [activeSoul]);
  const cleanDays = activeCycle?.cleanDays ?? 0;
  const deadSouls = useMemo(() => souls.filter(item => item.status === "dead"), [souls]);
  const latestDeadSoul = deadSouls[0] ?? null;
  const focusSoul = activeSoul ?? latestDeadSoul;
  const goalReached = activeCycle?.goalDays != null && cleanDays >= activeCycle.goalDays;
  const suggestedGoal = activeCycle ? Math.max(cleanDays, activeCycle.minCleanDays) + 1 : 1;
  const NoticeIcon = messageKind === "error" ? AlertTriangle : messageKind === "info" ? CircleDashed : CheckCircle2;

  const showMessage = (text: string, kind: "success" | "error" | "info" = "success") => {
    setMessageKind(kind);
    setMessage(text);
  };

  function load() {
    if (!userId) return;
    setIsLoading(true);
    setStateError("");
    void api<AppState>("/state").then(data => {
      if (isQueued(data)) return;
      setSoul(data.soul);
      setSouls(data.souls);
      setContacts(data.contacts);
      setOnboarding(data.souls.length === 0 && localStorage.getItem(`onboarding-exited-${userId}`) !== "true");
    }).catch(error => {
      const text = error instanceof Error ? error.message : "No se pudo cargar tu espacio.";
      if (text === "Usuario no encontrado") {
        localStorage.removeItem("userId");
        setUserId("");
        setSoul(null);
        setSouls([]);
        setContacts([]);
        setOnboarding(false);
        setIsLoading(false);
        return;
      }
      setStateError(text);
      showMessage("No se pudo actualizar", "error");
    }).finally(() => setIsLoading(false));
  }

  useEffect(() => { load(); }, [userId]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (soulReaction === "idle") return;
    const reactionDuration = soulReaction === "color" ? 3200 : soulReaction === "effect" ? 1400 : soulReaction === "size" ? 1100 : 1400;
    const timeout = window.setTimeout(() => setSoulReaction("idle"), reactionDuration);
    return () => window.clearTimeout(timeout);
  }, [soulReaction]);

  function updateOrbSettings(patch: Partial<OrbSettings>) {
    setOrbSettings(current => {
      const next = { ...current, ...patch };
      localStorage.setItem("soul-orb-settings", JSON.stringify(next));
      return next;
    });
    if (patch.palette) setSoulReaction("color");
    else if (patch.effect) setSoulReaction("effect");
    else if (patch.size) setSoulReaction("size");
  }

  async function createUser() {
    setPendingAction("profile");
    try {
      const data = await api<{ id: string }>("/users", { method: "POST", body: "{}" }, false);
      if (isQueued(data)) throw new Error("Necesitás conexión para crear el espacio.");
      localStorage.setItem("userId", data.id);
      setUserId(data.id);
      showMessage("Espacio listo");
    } catch { showMessage("No se pudo entrar", "error"); }
    finally { setPendingAction(""); }
  }

  function startNewSoul() {
    setSoulName("");
    setMin("1");
    setGoalInput("");
    setStartMode("now");
    setStartDate(today());
    setOnboarding(true);
  }

  async function createSoul() {
    setPendingAction("cycle");
    try {
      const cycleStart = startMode === "now" ? today() : startDate;
      const minValue = Number(min);
      const goalValue = goal.trim() === "" ? null : Number(goal);
      if (!soulName.trim()) { showMessage("Ponele un nombre a tu soul", "error"); return; }
      if (!Number.isInteger(minValue) || minValue < 1) { showMessage("El mínimo debe ser un entero mayor que cero", "error"); return; }
      if (goalValue !== null && (!Number.isInteger(goalValue) || goalValue <= minValue)) { showMessage("La meta debe superar el mínimo", "error"); return; }
      if (!cycleStart || cycleStart > today()) { showMessage("Revisá la fecha de inicio", "error"); return; }
      const result = await api<{ soul: SoulType }>("/souls", {
        method: "POST",
        body: JSON.stringify({ name: soulName.trim(), minCleanDays: minValue, goalDays: goalValue, startDate: cycleStart })
      });
      if (isQueued(result)) { setOnboarding(false); showMessage("Soul pendiente", "info"); return; }
      localStorage.removeItem(`onboarding-exited-${userId}`);
      setOnboarding(false);
      setSoulName("");
      setMin("1");
      setGoalInput("");
      setStartMode("now");
      setStartDate(today());
      setSoulReaction("awakening");
      showMessage("Soul y primer ciclo creados");
      load();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "No se pudo crear la soul", "error");
    } finally { setPendingAction(""); }
  }

  function openConsumption() {
    if (!activeCycle) return;
    setConsumptionDate(today());
    setNextAdditionalDays("");
    setConfirming("consumption");
  }

  async function admitConsumption(cycle: Cycle, eventDate: string, additional: string) {
    setPendingAction("consumption");
    try {
      if (!eventDate) { showMessage("Elegí una fecha", "error"); return; }
      if (eventDate < cycle.startDate || eventDate > today()) { showMessage("La fecha debe estar dentro del ciclo y no puede ser futura", "error"); return; }
      const additionalValue = additional.trim() === "" ? undefined : Number(additional);
      if (additionalValue !== undefined && (!Number.isInteger(additionalValue) || additionalValue < 0)) { showMessage("La amplitud debe ser un entero no negativo", "error"); return; }
      const data = await api<{ cleanDays: number; soulStatus: string; nextMinCleanDays: number | null; nextGoalDays: number | null }>(`/cycles/${cycle.id}/admit-consumption`, {
        method: "POST",
        body: JSON.stringify({ eventDate, nextGoalAdditionalDays: additionalValue })
      });
      if (isQueued(data)) { showMessage("Registro pendiente", "info"); return; }
      setConfirming(null);
      setNextAdditionalDays("");
      setSoulReaction(data.soulStatus === "dead" ? "dead" : "consumption");
      if (data.soulStatus === "dead") {
        showMessage("La soul murió. Su memoria queda guardada.", "error");
      } else {
        const goalMessage = data.nextGoalDays ? ` Próxima meta: ${data.nextGoalDays} días.` : " Próximo ciclo sin meta.";
        showMessage(`Ciclo cerrado con ${data.cleanDays} días. Próximo mínimo: ${data.nextMinCleanDays}.${goalMessage}`);
      }
      load();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "No se pudo registrar el consumo", "error");
    } finally { setPendingAction(""); }
  }

  function openGoalDialog() {
    if (!activeCycle) return;
    setNewGoalInput(String(suggestedGoal));
    setGoalDialogOpen(true);
  }

  async function saveGoal() {
    if (!activeCycle) return;
    const value = Number(goalInput);
    if (!Number.isInteger(value) || value <= 0) { showMessage("La meta debe ser un entero positivo", "error"); return; }
    setPendingAction("goal");
    try {
      const result = await api(`/cycles/${activeCycle.id}/goal`, { method: "POST", body: JSON.stringify({ goalDays: value }) });
      if (isQueued(result)) { showMessage("Meta pendiente", "info"); return; }
      setGoalDialogOpen(false);
      setNewGoalInput("");
      setSoulReaction("goal");
      showMessage("Meta guardada");
      load();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "No se pudo guardar la meta", "error");
    } finally { setPendingAction(""); }
  }

  async function renameSoul(value = renameValue) {
    const name = value.trim();
    if (!name || !activeSoul) return;
    try {
      const data = await api(`/souls/${activeSoul.id}/name`, { method: "POST", body: JSON.stringify({ name }) });
      if (isQueued(data)) { showMessage("Nombre pendiente", "info"); return; }
      setSoul(current => current ? { ...current, name } : current);
      setSouls(current => current.map(item => item.id === activeSoul.id ? { ...item, name } : item));
      setIsRenaming(false);
      setSoulReaction("rename");
      showMessage("Nombre actualizado");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "No se pudo cambiar", "error");
    }
  }

  async function askCoach() {
    setPendingAction("coach");
    try {
      const data = await api<{ feedback: string }>("/coach/reflection", {
        method: "POST",
        body: JSON.stringify({ cycleId: activeCycle?.id, reflection })
      });
      if (isQueued(data)) { showMessage("Reflexión pendiente", "info"); return; }
      setFeedback(data.feedback);
      showMessage("Respuesta lista");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "No se pudo consultar", "error");
    } finally { setPendingAction(""); }
  }

  async function addContact() {
    setPendingAction("contact");
    try {
      const data = await api("/contacts", { method: "POST", body: JSON.stringify({ name: contactName, email: contactEmail }) });
      setContactName("");
      setContactEmail("");
      setContactFormOpen(false);
      if (isQueued(data)) { showMessage("Contacto pendiente", "info"); return; }
      showMessage("Contacto añadido");
      load();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "No se pudo añadir", "error");
    } finally { setPendingAction(""); }
  }

  function saveProfilePhoto(file: File) {
    if (!file.type.startsWith("image/")) { showMessage("Imagen no válida", "error"); return; }
    if (file.size > 2_500_000) { showMessage("Máximo 2,5 MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") { showMessage("No se pudo leer", "error"); return; }
      localStorage.setItem("abstinencia-profile-photo", reader.result);
      setProfilePhoto(reader.result);
      showMessage("Foto guardada");
    };
    reader.onerror = () => showMessage("No se pudo leer", "error");
    reader.readAsDataURL(file);
  }

  async function deleteUserData() {
    setPendingAction("delete");
    try {
      await api("/users/me", { method: "DELETE" });
      localStorage.clear();
      setConfirming(null);
      setUserId("");
      setSoul(null);
      setSouls([]);
      setContacts([]);
      setProfilePhoto("");
    } catch { showMessage("No se pudo borrar", "error"); }
    finally { setPendingAction(""); }
  }

  if (!userId) return <main className="onboarding">
    <div className="brand"><span className="sr-only">En calma</span></div>
    <section className="welcome">
      <EmptySoulOrb />
      <button className="primary empty-primary" type="button" disabled={pendingAction === "profile"} onClick={() => void createUser()}>
        <span>Entrar</span>{pendingAction === "profile" ? <LoaderCircle className="spin" aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}
      </button>
    </section>
  </main>;

  if (isLoading) return <main className="loading-screen">
    <div className="brand"><span className="sr-only">En calma</span></div>
    <section className="loading-stage" aria-live="polite"><span className="loading-orb" aria-hidden="true" /><span className="sr-only">Cargando</span></section>
  </main>;

  if (onboarding) return <CycleOnboarding
    soulName={soulName}
    setSoulName={setSoulName}
    min={min}
    setMin={setMin}
    goal={goal}
    setGoal={setGoalInput}
    startMode={startMode}
    setStartMode={setStartMode}
    startDate={startDate}
    setStartDate={setStartDate}
    onFinish={createSoul}
    onExit={() => {
      localStorage.setItem(`onboarding-exited-${userId}`, "true");
      setOnboarding(false);
    }}
  />;

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="sr-only">En calma</span></div><Navigation view={view} setView={setView} /></aside>
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    <section className="content" id="main-content">
      <div className="mobile-nav"><Navigation view={view} setView={setView} /></div>
      {stateError
        ? <section className="state-error" role="alert"><AlertTriangle aria-hidden="true" /><div><strong>Sin conexión</strong><details><summary>Detalle</summary><span>{stateError}</span></details></div><button className="icon-action quiet-icon" type="button" title="Reintentar" aria-label="Reintentar" onClick={load}><RotateCcw aria-hidden="true" /></button></section>
        : <AnimatePresence mode="wait"><motion.div key={view} className="view-content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .28, ease: [0.2, 0, 0, 1] }}>

          {view === "dashboard" && <section className="dashboard">
            {activeSoul
              ? <Soul soul={activeSoul} cycle={activeCycle ?? undefined} cleanDays={cleanDays} reaction={soulReaction} settings={orbSettings} onSettingsChange={updateOrbSettings} />
              : <NoSoul deadSoul={latestDeadSoul} onCreate={startNewSoul} onOpenMemory={() => setView("soul")} />}
          </section>}

          {view === "soul" && (focusSoul
            ? <section className={`soul-management ${focusSoul.status === "dead" ? "is-dead" : ""}`}>
              <header className="soul-management-head">
                <div className="soul-identity">
                  <h2>{focusSoul.name}</h2>
                  <span className={`status-pip ${focusSoul.status === "alive" ? "online" : ""}`} title={focusSoul.status === "alive" ? "Soul viva" : "Soul muerta"} />
                  <span className="sr-only">{focusSoul.status === "alive" ? "Soul viva" : "Soul muerta"}</span>
                </div>
                <div className="soul-management-tools">
                  <SoulCustomizer settings={orbSettings} onSettingsChange={updateOrbSettings} />
                  <div className="management-top-actions">
                    {activeSoul && activeCycle && <button className="icon-action danger-icon" type="button" title="Admitir consumo" aria-label="Admitir consumo" disabled={pendingAction === "consumption"} onClick={openConsumption}>{pendingAction === "consumption" ? <LoaderCircle className="spin" aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}</button>}
                    {focusSoul.status === "alive" && !isRenaming && <button className="icon-action quiet-icon" type="button" title="Renombrar" aria-label="Renombrar" onClick={() => { setRenameValue(focusSoul.name); setIsRenaming(true); }}><Edit3 aria-hidden="true" /></button>}
                  </div>
                  <div className="management-max" title="Máximo de días"><Trophy aria-hidden="true" /><strong>{focusSoul.maxPurityDays}</strong><span className="sr-only">Máximo de {focusSoul.maxPurityDays} días</span></div>
                </div>
              </header>

              {focusSoul.status === "alive" && isRenaming && <form className="rename-form" onSubmit={event => { event.preventDefault(); void renameSoul(); }}>
                <label className="sr-only" htmlFor="rename-soul">Nombre</label>
                <input id="rename-soul" value={renameValue} maxLength={40} autoFocus onChange={event => setRenameValue(event.target.value)} />
                <div>
                  <button className="icon-action primary-icon" type="submit" title="Guardar" aria-label="Guardar" disabled={!renameValue.trim()}><Check aria-hidden="true" /></button>
                  <button className="icon-action quiet-icon" type="button" title="Cancelar" aria-label="Cancelar" onClick={() => setIsRenaming(false)}><X aria-hidden="true" /></button>
                </div>
              </form>}

              {focusSoul.status === "alive" && activeCycle && <div className="management-goal-row">
                {activeCycle.goalDays === null
                  ? <button className="goal-action" type="button" onClick={openGoalDialog}>Fijar meta</button>
                  : goalReached
                    ? <button className="goal-action is-reached" type="button" onClick={openGoalDialog}>Ampliar meta</button>
                    : <span className="goal-note">Meta actual: {activeCycle.goalDays} días. Se puede ampliar al alcanzarla.</span>}
                <span className="goal-min">Mínimo {activeCycle.minCleanDays}</span>
              </div>}

              {focusSoul.status === "dead" && <div className="dead-actions">
                <span className="dead-note">Esta soul ya no puede continuar. Su historia queda en la memoria.</span>
                <button className="primary new-soul" type="button" onClick={startNewSoul}><span>Nueva soul</span><Plus aria-hidden="true" /></button>
              </div>}

              {focusSoul.cycles.length > 0 && <section className="management-history" aria-label="Historial de ciclos">
                <h3 className="sr-only">Historial</h3>
                {focusSoul.cycles.map(cycle => {
                  const StatusIcon = cycle.status === "completed" ? CheckCircle2 : cycle.status === "failed" ? CircleX : CircleDashed;
                  const days = cycle.status === "active" ? cycle.cleanDays : cycle.finalCleanDays ?? cycle.cleanDays;
                  return <div className="history-row" key={cycle.id} aria-label={`Ciclo ${cycle.cycleNumber}: ${statusLabels[cycle.status] || cycle.status}, ${days} días`}>
                    <span className={`history-index ${cycle.status}`}>{String(cycle.cycleNumber).padStart(2, "0")}</span>
                    <strong className="history-range">{cycle.minCleanDays}<span aria-hidden="true">→</span>{cycle.goalDays ?? "—"}<small>{days} días · {formatDate(cycle.startDate)}</small></strong>
                    <span className={`history-status ${cycle.status}`} title={statusLabels[cycle.status] || cycle.status}><StatusIcon aria-hidden="true" /><span className="sr-only">{statusLabels[cycle.status] || cycle.status}</span></span>
                  </div>;
                })}
              </section>}

              <SoulMemory souls={deadSouls} />
            </section>
            : <NoSoul onCreate={startNewSoul} />)}

          {view === "coach" && <section className="coach-page"><section className="reflection-panel">
            <div className="composer-sigil" aria-hidden="true"><Sparkles /></div>
            <label className="sr-only" htmlFor="reflection">Tu reflexión</label>
            <textarea id="reflection" rows={8} maxLength={10000} value={reflection} onChange={event => setReflection(event.target.value)} placeholder="Escribí…" />
            <div className="panel-footer">
              {reflection.length > 9500 ? <span className="character-count" aria-live="polite">{reflection.length} / 10k</span> : <span />}
              <button className="primary" type="button" aria-label="Consultar coach" disabled={!reflection.trim() || pendingAction === "coach"} onClick={() => void askCoach()}><span>Enviar</span>{pendingAction === "coach" ? <LoaderCircle className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />}</button>
            </div>
            {feedback && <details className="feedback" open><summary><Sparkles aria-hidden="true" /><span>Respuesta</span></summary><p>{feedback}</p></details>}
          </section></section>}

          {view === "contacts" && <section className="contacts-page">
            <header className="contacts-top">
              <div className="contact-cluster" aria-label={`${contacts.length} contactos`}>{contacts.length ? contacts.slice(0, 4).map(contact => <span className="cluster-avatar" key={contact.id}>{contact.contact_name.charAt(0).toUpperCase()}</span>) : <Users aria-hidden="true" />}</div>
              <button className="icon-action primary-icon" type="button" title="Añadir contacto" aria-label="Añadir contacto" aria-expanded={contactFormOpen} onClick={() => setContactFormOpen(value => !value)}>{contactFormOpen ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}</button>
            </header>
            <AnimatePresence>{contactFormOpen && <motion.form className="contact-form" initial={{ opacity: 0, y: -8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: .98 }} transition={{ duration: .2, ease: [0.2, 0, 0, 1] }} onSubmit={event => { event.preventDefault(); void addContact(); }}>
              <div className="field"><label className="sr-only" htmlFor="contact-name">Nombre</label><input id="contact-name" value={contactName} onChange={event => setContactName(event.target.value)} placeholder="Nombre" /></div>
              <div className="field"><label className="sr-only" htmlFor="contact-email">Correo</label><input id="contact-email" type="email" value={contactEmail} onChange={event => setContactEmail(event.target.value)} placeholder="correo@…" /></div>
              <button className="icon-action primary-icon" type="submit" title="Añadir" aria-label="Añadir" disabled={!contactName.trim() || !contactEmail.trim() || pendingAction === "contact"}>{pendingAction === "contact" ? <LoaderCircle className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}</button>
            </motion.form>}</AnimatePresence>
            <section className="contact-list" aria-label="Contactos">{contacts.length === 0
              ? <div className="contact-empty"><Users aria-hidden="true" /><span className="sr-only">No hay contactos</span></div>
              : contacts.map(contact => {
                const isExpanded = expandedContact === contact.id;
                return <button className={`contact-row ${isExpanded ? "is-expanded" : ""}`} type="button" key={contact.id} aria-expanded={isExpanded} aria-label={isExpanded ? `${contact.contact_name}, ${contact.contact_email}` : `Mostrar correo de ${contact.contact_name}`} onClick={() => setExpandedContact(current => current === contact.id ? null : contact.id)}>
                  <span className="contact-avatar" aria-hidden="true">{contact.contact_name.charAt(0).toUpperCase()}</span>
                  <span className="contact-name">{contact.contact_name}</span>
                  <Mail className="contact-mail" aria-hidden="true" />
                  <span className="contact-email">{contact.contact_email}</span>
                </button>;
              })}</section>
          </section>}

          {view === "profile" && <section className="profile-page"><section className="profile-panel">
            <div className="profile-photo-row"><div className="profile-avatar">{profilePhoto ? <img src={profilePhoto} alt="Foto de perfil" /> : <UserRound aria-hidden="true" />}<label className="photo-upload" title="Cambiar foto"><ImagePlus aria-hidden="true" /><span className="sr-only">Cambiar foto</span><input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) saveProfilePhoto(file); event.target.value = ""; }} /></label></div></div>
            <button className="danger-tile" type="button" onClick={() => setConfirming("delete")}><span>Borrar</span><Trash2 aria-hidden="true" /></button>
          </section></section>}

        </motion.div></AnimatePresence>}
    </section>

    {confirming && <div className="confirm-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setConfirming(null); }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
        <AlertTriangle aria-hidden="true" />
        <h2 id="confirm-title">{confirming === "delete" ? "Borrar todo" : "Registrar consumo"}</h2>
        <p id="confirm-description">{confirming === "delete" ? "No se puede deshacer." : "Cierra este ciclo. Si no superás el mínimo, la soul muere y su memoria queda guardada."}</p>
        {confirming === "consumption" && activeCycle && <>
          <label className="confirm-date-field" title="Fecha de consumo">
            <CalendarDays aria-hidden="true" /><span>Fecha del consumo</span>
            <input ref={consumptionDateInputRef} type="date" min={activeCycle.startDate} max={today()} value={consumptionDate} onChange={event => setConsumptionDate(event.target.value)} onClick={event => { const input = event.currentTarget; if (typeof input.showPicker === "function") input.showPicker(); }} />
          </label>
          <label className="confirm-date-field" title="Amplitud de la próxima meta">
            <Trophy aria-hidden="true" /><span>Amplitud de la próxima meta (opcional)</span>
            <input type="number" min="0" inputMode="numeric" value={nextAdditionalDays} placeholder="Sin meta" onChange={event => setNextAdditionalDays(event.target.value)} />
          </label>
          <small className="confirm-hint">Se suma al próximo mínimo. Si lo dejás vacío, el próximo ciclo empieza sin meta.</small>
        </>}
        <div className="confirm-actions">
          <button className="quiet-button" type="button" onClick={() => setConfirming(null)}>Volver</button>
          <button className="danger-button" type="button" disabled={pendingAction !== ""} onClick={() => {
            if (confirming === "delete") void deleteUserData();
            else if (activeCycle) void admitConsumption(activeCycle, consumptionDate, nextAdditionalDays);
          }}>{confirming === "delete" ? "Borrar" : "Registrar"}{pendingAction && <LoaderCircle className="spin" aria-hidden="true" />}</button>
        </div>
      </section>
    </div>}

    {goalDialogOpen && activeCycle && <div className="confirm-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setGoalDialogOpen(false); }}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="goal-title" aria-describedby="goal-description">
        <Trophy aria-hidden="true" />
        <h2 id="goal-title">{activeCycle.goalDays === null ? "Fijar meta" : "Ampliar meta"}</h2>
        <p id="goal-description">La nueva meta debe superar {Math.max(cleanDays, activeCycle.minCleanDays)} días. Podés fijarla y ampliarla cuando la alcances.</p>
        <label className="confirm-date-field" title="Nueva meta">
          <Trophy aria-hidden="true" /><span>Nueva meta (días)</span>
          <input type="number" min={suggestedGoal} inputMode="numeric" value={goalInput} autoFocus onChange={event => setNewGoalInput(event.target.value)} />
        </label>
        <div className="confirm-actions">
          <button className="quiet-button" type="button" onClick={() => setGoalDialogOpen(false)}>Volver</button>
          <button className="primary" type="button" disabled={pendingAction === "goal"} onClick={() => void saveGoal()}>{pendingAction === "goal" ? <LoaderCircle className="spin" aria-hidden="true" /> : "Guardar"}</button>
        </div>
      </section>
    </div>}

    {message && <motion.div className={`notice ${messageKind}`} role={messageKind === "error" ? "alert" : "status"} initial={{ opacity: 0, y: -14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}>
      <NoticeIcon aria-hidden="true" /><span>{message}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setMessage("")}><X aria-hidden="true" /></button>
    </motion.div>}
  </main>;
}
