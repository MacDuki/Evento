import {
  AlertTriangle, ArrowUpRight, CalendarDays, Check, CheckCircle2, CircleDashed,
  CircleX, Edit3, ImagePlus, LoaderCircle, Mail, MessageCircle, Plus, RotateCcw,
  Send, Sparkles, Trash2, Trophy, UserRound, Users, X
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { flush, type QueuedRequest } from "./offline.js";
import { CycleOnboarding } from "./pages/Onboarding/CycleOnboarding.js";
import { Soul, SoulCustomizer } from "./pages/Soul/Soul.js";
import { EmptySoulOrb, NoSoul } from "./components/common/EmptySoul.js";
import { Navigation } from "./components/layout/Navigation.js";
import { defaultOrbSettings, statusLabels } from "./constants/app.js";
import { api, isQueued } from "./services/api.js";
import { dateAfter, daysSince, formatDate, today } from "./utils/dates.js";
import type { Contact, Cycle, OrbSettings, SoulReaction, SoulState, View } from "./types.js";
export function App() {
  const [userId, setUserId] = useState(localStorage.getItem("userId") || "");
  const [isLoading, setIsLoading] = useState(Boolean(localStorage.getItem("userId")));
  const [stateError, setStateError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [soul, setSoul] = useState<SoulState>({ soul_name: "Soul", soul_status: "alive", soul_max_purity_days: 0 });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [view, setView] = useState<View>("dashboard");
  const [min, setMin] = useState("1"); const [goal, setGoalInput] = useState("2"); const [soulName, setSoulName] = useState("Aurora");
  const [startMode, setStartMode] = useState<"now" | "past">("now");
  const [startDate, setStartDate] = useState(today); const [endDate, setEndDate] = useState(() => dateAfter(7)); const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error" | "info">("success");
  const [consumptionDate, setConsumptionDate] = useState(today);
  const consumptionDateInputRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState<"consumption" | "delete" | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [onboarding, setOnboarding] = useState(false);
  const [reflection, setReflection] = useState(""); const [feedback, setFeedback] = useState("");
  const [contactName, setContactName] = useState(""); const [contactEmail, setContactEmail] = useState("");
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
  const activeCycle = useMemo(() => cycles.find(cycle => cycle.status === "active"), [cycles]);
  const cleanDays = activeCycle ? daysSince(activeCycle.start_date) : 0;
  const NoticeIcon = messageKind === "error" ? AlertTriangle : messageKind === "info" ? CircleDashed : CheckCircle2;
  const showMessage = (text: string, kind: "success" | "error" | "info" = "success") => { setMessageKind(kind); setMessage(text); };
  const load = () => {
    if (!userId) return;
    setIsLoading(true); setStateError("");
    void api<{ cycles: Cycle[]; contacts: Contact[]; soul: SoulState }>("/state").then(data => {
      if (isQueued(data)) return;
      setCycles(data.cycles); setContacts(data.contacts); setSoul(data.soul);
      setOnboarding(data.cycles.length === 0 && localStorage.getItem(`onboarding-exited-${userId}`) !== "true");
    }).catch(error => {
      setStateError(error instanceof Error ? error.message : "No se pudo cargar tu espacio.");
      showMessage("No se pudo actualizar", "error");
    }).finally(() => setIsLoading(false));
  };
  useEffect(() => { load(); }, [userId]);
  useEffect(() => { if (!message) return; const timeout = window.setTimeout(() => setMessage(""), 5000); return () => window.clearTimeout(timeout); }, [message]);
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
      localStorage.setItem("userId", data.id); setUserId(data.id); showMessage("Espacio listo");
    }
    catch { showMessage("No se pudo entrar", "error"); }
    finally { setPendingAction(""); }
  }
  async function createCycle() {
    setPendingAction("cycle");
    try {
      const cycleStart = startMode === "now" ? today() : startDate;
      const cycleEnd = startMode === "past" ? today() : endDate;
      if (!cycleStart || !cycleEnd || cycleEnd < cycleStart) { showMessage("Revisá las fechas", "error"); return; }
      const cycleResult = await api("/cycles", { method: "POST", body: JSON.stringify({ minCleanDays: Number(min), targetGoalDays: Number(goal), startDate: cycleStart, endDate: cycleEnd }) });
      if (isQueued(cycleResult)) { setOnboarding(false); showMessage("Ciclo pendiente", "info"); return; }
      const nameResult = soulName.trim() ? await api("/soul/name", { method: "POST", body: JSON.stringify({ name: soulName.trim() }) }) : null;
      localStorage.removeItem(`onboarding-exited-${userId}`);
      setOnboarding(false); setSoulReaction("awakening"); showMessage(isQueued(nameResult) ? "Nombre pendiente" : "Ciclo iniciado", isQueued(nameResult) ? "info" : "success"); load();
    }
    catch { showMessage("No se pudo crear", "error"); }
    finally { setPendingAction(""); }
  }
  async function admitConsumption(id: string, eventDate: string) {
    setPendingAction("consumption");
    try {
      if (!eventDate) { showMessage("Elegí una fecha", "error"); return; }
      const data = await api<{ soulStatus: string; nextMinCleanDays: number | null }>(`/cycles/${id}/admit-consumption`, { method: "POST", body: JSON.stringify({ eventDate }) });
      if (isQueued(data)) { showMessage("Registro pendiente", "info"); return; }
      setConfirming(null); setSoulReaction(data.soulStatus === "dead" ? "dead" : "consumption");
      showMessage(data.soulStatus === "dead" ? "Soul detenida" : "Registro guardado", data.soulStatus === "dead" ? "error" : "success");
      load();
    } catch { showMessage("No se pudo registrar", "error"); }
    finally { setPendingAction(""); }
  }
  async function renameSoul(value = renameValue) {
    const name = value.trim();
    if (!name) return;
    try { const data = await api("/soul/name", { method: "POST", body: JSON.stringify({ name }) }); if (isQueued(data)) { showMessage("Nombre pendiente", "info"); return; } setSoul(value => ({ ...value, soul_name: name })); setIsRenaming(false); setSoulReaction("rename"); showMessage("Nombre actualizado"); }
    catch { showMessage("No se pudo cambiar", "error"); }
  }
  async function askCoach() {
    setPendingAction("coach");
    try { const data = await api<{ feedback: string }>("/coach/reflection", { method: "POST", body: JSON.stringify({ reflection }) }); if (isQueued(data)) { showMessage("Reflexión pendiente", "info"); return; } setFeedback(data.feedback); showMessage("Respuesta lista"); }
    catch { showMessage("No se pudo consultar", "error"); }
    finally { setPendingAction(""); }
  }
  async function addContact() {
    setPendingAction("contact");
    try { const data = await api("/contacts", { method: "POST", body: JSON.stringify({ name: contactName, email: contactEmail }) }); setContactName(""); setContactEmail(""); setContactFormOpen(false); if (isQueued(data)) { showMessage("Contacto pendiente", "info"); return; } showMessage("Contacto añadido"); load(); }
    catch { showMessage("No se pudo añadir", "error"); }
    finally { setPendingAction(""); }
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
      setProfilePhoto("");
    } catch { showMessage("No se pudo borrar", "error"); }
    finally { setPendingAction(""); }
  }
  if (!userId) return <main className="onboarding"><div className="brand"><span className="sr-only">En calma</span></div><section className="welcome"><EmptySoulOrb /><button className="primary empty-primary" type="button" disabled={pendingAction === "profile"} onClick={() => void createUser()}><span>Entrar</span>{pendingAction === "profile" ? <LoaderCircle className="spin" aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}</button></section></main>;
  if (isLoading) return <main className="loading-screen"><div className="brand"><span className="sr-only">En calma</span></div><section className="loading-stage" aria-live="polite"><span className="loading-orb" aria-hidden="true" /><span className="sr-only">Cargando</span></section></main>;
  if (onboarding) return <CycleOnboarding soulName={soulName} setSoulName={setSoulName} min={min} setMin={setMin} goal={goal} setGoalInput={setGoalInput} startMode={startMode} setStartMode={setStartMode} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} onFinish={createCycle} onExit={() => { localStorage.setItem(`onboarding-exited-${userId}`, "true"); setOnboarding(false); }} />;
  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="sr-only">En calma</span></div><Navigation view={view} setView={setView} /></aside>
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    <section className="content" id="main-content"><div className="mobile-nav"><Navigation view={view} setView={setView} /></div>
      {stateError ? <section className="state-error" role="alert"><AlertTriangle aria-hidden="true" /><div><strong>Sin conexión</strong><details><summary>Detalle</summary><span>{stateError}</span></details></div><button className="icon-action quiet-icon" type="button" title="Reintentar" aria-label="Reintentar" onClick={load}><RotateCcw aria-hidden="true" /></button></section> : <AnimatePresence mode="wait"><motion.div key={view} className="view-content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .28, ease: [0.2, 0, 0, 1] }}>
        {view === "dashboard" && <section className="dashboard">
          {activeCycle ? <Soul cycle={activeCycle} cleanDays={cleanDays} soulStatus={soul.soul_status} reaction={soulReaction} settings={orbSettings} onSettingsChange={updateOrbSettings} /> : <NoSoul onCreate={() => setOnboarding(true)} />}
        </section>}
        {view === "soul" && <section className="soul-management">
          <header className="soul-management-head"><div className="soul-identity"><h2>{soul.soul_name}</h2><span className="sr-only">{soul.soul_status === "alive" ? "Viva" : "Muerta"}</span></div><div className="soul-management-tools"><SoulCustomizer settings={orbSettings} onSettingsChange={updateOrbSettings} /><div className="management-top-actions"><button className="icon-action danger-icon" type="button" title="Admitir consumo" aria-label="Admitir consumo" disabled={pendingAction === "consumption"} onClick={() => setConfirming("consumption")}>{pendingAction === "consumption" ? <LoaderCircle className="spin" aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}</button>{soul.soul_status === "alive" && !isRenaming && <button className="icon-action quiet-icon" type="button" title="Renombrar" aria-label="Renombrar" onClick={() => { setRenameValue(soul.soul_name); setIsRenaming(true); }}><Edit3 aria-hidden="true" /></button>}</div><div className="management-max" title="Máximo de días"><Trophy aria-hidden="true" /><strong>{soul.soul_max_purity_days}</strong><span className="sr-only">Máximo de {soul.soul_max_purity_days} días</span></div></div></header>
          {activeCycle && <div className="management-actions">
            {soul.soul_status === "alive" && isRenaming && <form className="rename-form" onSubmit={event => { event.preventDefault(); void renameSoul(); }}><label className="sr-only" htmlFor="rename-soul">Nombre</label><input id="rename-soul" value={renameValue} maxLength={40} autoFocus onChange={event => setRenameValue(event.target.value)} /><div><button className="icon-action primary-icon" type="submit" title="Guardar" aria-label="Guardar" disabled={!renameValue.trim()}><Check aria-hidden="true" /></button><button className="icon-action quiet-icon" type="button" title="Cancelar" aria-label="Cancelar" onClick={() => setIsRenaming(false)}><X aria-hidden="true" /></button></div></form>}
          </div>}
          {!activeCycle && soul.soul_status === "alive" && <button className="primary new-cycle" type="button" onClick={() => setOnboarding(true)}><span>Nuevo ciclo</span><Plus aria-hidden="true" /></button>}
          {cycles.length > 0 && <section className="management-history" aria-label="Historial de ciclos"><h3 className="sr-only">Historial</h3>{cycles.map(cycle => { const StatusIcon = cycle.status === "completed" ? CheckCircle2 : cycle.status === "failed" ? CircleX : CircleDashed; return <div className="history-row" key={cycle.id} aria-label={`Ciclo ${cycle.cycle_number}: ${statusLabels[cycle.status] || cycle.status}`}><span className={`history-index ${cycle.status}`}>{String(cycle.cycle_number).padStart(2, "0")}</span><strong className="history-range">{cycle.min_clean_days}<span aria-hidden="true">→</span>{cycle.target_goal_days}</strong><span className={`history-status ${cycle.status}`} title={statusLabels[cycle.status] || cycle.status}><StatusIcon aria-hidden="true" /><span className="sr-only">{statusLabels[cycle.status] || cycle.status}{cycle.planned_end_date ? `, ${formatDate(cycle.planned_end_date)}` : ""}</span></span></div>; })}</section>}
        </section>}
        {view === "coach" && <section className="coach-page"><section className="reflection-panel"><div className="composer-sigil" aria-hidden="true"><Sparkles /></div><label className="sr-only" htmlFor="reflection">Tu reflexión</label><textarea id="reflection" rows={8} maxLength={10000} value={reflection} onChange={e => setReflection(e.target.value)} placeholder="Escribí…" /><div className="panel-footer">{reflection.length > 9500 ? <span className="character-count" aria-live="polite">{reflection.length} / 10k</span> : <span />}<button className="primary" type="button" aria-label="Consultar coach" disabled={!reflection.trim() || pendingAction === "coach"} onClick={() => void askCoach()}><span>Enviar</span>{pendingAction === "coach" ? <LoaderCircle className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />}</button></div>{feedback && <details className="feedback" open><summary><Sparkles aria-hidden="true" /><span>Respuesta</span></summary><p>{feedback}</p></details>}</section></section>}
        {view === "contacts" && <section className="contacts-page"><header className="contacts-top"><div className="contact-cluster" aria-label={`${contacts.length} contactos`}>{contacts.length ? contacts.slice(0, 4).map(contact => <span className="cluster-avatar" key={contact.id}>{contact.contact_name.charAt(0).toUpperCase()}</span>) : <Users aria-hidden="true" />}</div><button className="icon-action primary-icon" type="button" title="Añadir contacto" aria-label="Añadir contacto" aria-expanded={contactFormOpen} onClick={() => setContactFormOpen(value => !value)}>{contactFormOpen ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}</button></header><AnimatePresence>{contactFormOpen && <motion.form className="contact-form" initial={{ opacity: 0, y: -8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: .98 }} transition={{ duration: .2, ease: [0.2, 0, 0, 1] }} onSubmit={event => { event.preventDefault(); void addContact(); }}><div className="field"><label className="sr-only" htmlFor="contact-name">Nombre</label><input id="contact-name" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nombre" /></div><div className="field"><label className="sr-only" htmlFor="contact-email">Correo</label><input id="contact-email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="correo@…" /></div><button className="icon-action primary-icon" type="submit" title="Añadir" aria-label="Añadir" disabled={!contactName.trim() || !contactEmail.trim() || pendingAction === "contact"}>{pendingAction === "contact" ? <LoaderCircle className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}</button></motion.form>}</AnimatePresence><section className="contact-list" aria-label="Contactos">{contacts.length === 0 ? <div className="contact-empty"><Users aria-hidden="true" /><span className="sr-only">No hay contactos</span></div> : contacts.map(contact => { const isExpanded = expandedContact === contact.id; return <button className={`contact-row ${isExpanded ? "is-expanded" : ""}`} type="button" key={contact.id} aria-expanded={isExpanded} aria-label={isExpanded ? `${contact.contact_name}, ${contact.contact_email}` : `Mostrar correo de ${contact.contact_name}`} onClick={() => setExpandedContact(current => current === contact.id ? null : contact.id)}><span className="contact-avatar" aria-hidden="true">{contact.contact_name.charAt(0).toUpperCase()}</span><span className="contact-name">{contact.contact_name}</span><Mail className="contact-mail" aria-hidden="true" /><span className="contact-email">{contact.contact_email}</span></button>; })}</section></section>}
        {view === "profile" && <section className="profile-page"><section className="profile-panel"><div className="profile-photo-row"><div className="profile-avatar">{profilePhoto ? <img src={profilePhoto} alt="Foto de perfil" /> : <UserRound aria-hidden="true" />}<label className="photo-upload" title="Cambiar foto"><ImagePlus aria-hidden="true" /><span className="sr-only">Cambiar foto</span><input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) saveProfilePhoto(file); event.target.value = ""; }} /></label></div></div><button className="danger-tile" type="button" onClick={() => setConfirming("delete")}><span>Borrar</span><Trash2 aria-hidden="true" /></button></section></section>}
      </motion.div></AnimatePresence>}
    </section>
    {confirming && <div className="confirm-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setConfirming(null); }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><AlertTriangle aria-hidden="true" /><h2 id="confirm-title">{confirming === "delete" ? "Borrar todo" : "Registrar consumo"}</h2><p id="confirm-description">{confirming === "delete" ? "No se puede deshacer." : "Cierra este ciclo."}</p>{confirming === "consumption" && activeCycle && <label className="confirm-date-field" title="Fecha de consumo"><CalendarDays aria-hidden="true" /><span>Fecha del consumo</span><input ref={consumptionDateInputRef} type="date" min={activeCycle.start_date.slice(0, 10)} value={consumptionDate} onChange={event => setConsumptionDate(event.target.value)} onClick={event => { const input = event.currentTarget; if (typeof input.showPicker === "function") input.showPicker(); }} /></label>}<div className="confirm-actions"><button className="quiet-button" type="button" onClick={() => setConfirming(null)}>Volver</button><button className="danger-button" type="button" disabled={pendingAction !== ""} onClick={() => { if (confirming === "delete") void deleteUserData(); else if (activeCycle) void admitConsumption(activeCycle.id, consumptionDate); }}>{confirming === "delete" ? "Borrar" : "Registrar"}{pendingAction && <LoaderCircle className="spin" aria-hidden="true" />}</button></div></section></div>}
    {message && <motion.div className={`notice ${messageKind}`} role={messageKind === "error" ? "alert" : "status"} initial={{ opacity: 0, y: -14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}><NoticeIcon aria-hidden="true" /><span>{message}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setMessage("")}><X aria-hidden="true" /></button></motion.div>}
  </main>;
}
