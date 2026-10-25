import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight, HeartHandshake, Home,
  Menu, MessageCircle, Plus, Sparkles, Users, X
} from "lucide-react";
import { ShimmerButton } from "../components/ui/shimmer-button.js";
import "./style.css";
import { enqueue, flush, type QueuedRequest } from "./offline.js";

type Cycle = { id: string; cycle_number: number; min_clean_days: number; target_goal_days: number; start_date: string; status: string; deficit_days?: number };
type SoulState = { soul_name: string; soul_status: "alive" | "dead"; soul_max_purity_days: number };
type Contact = { id: string; contact_name: string; contact_email: string };
type View = "dashboard" | "soul" | "coach" | "contacts";
const statusLabels: Record<string, string> = { active: "En curso", completed: "Completado", failed: "Fallido" };
const navItems: { id: View; label: string; short: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Mi camino", short: "Camino", icon: Home },
  { id: "soul", label: "Gestionar soul", short: "Soul", icon: Sparkles },
  { id: "coach", label: "Coach reflexivo", short: "Coach", icon: MessageCircle },
  { id: "contacts", label: "Red de apoyo", short: "Apoyo", icon: Users }
];
const api = async <T = Record<string, unknown>,>(path: string, options?: RequestInit): Promise<T> => {
  const request = { headers: { "Content-Type": "application/json", "x-user-id": localStorage.getItem("userId") || "" }, ...options };
  let response: Response;
  try { response = await fetch(`/api${path}`, request); }
  catch (error) {
    if (options?.method && options.method !== "GET") { enqueue({ path, options: request }); return { queued: true } as T; }
    throw error;
  }
  const body = await response.text();
  let data: { error?: string; [key: string]: unknown } = {};
  if (body) {
    try { data = JSON.parse(body) as typeof data; }
    catch { throw new Error(`Respuesta inválida del servidor (${response.status})`); }
  }
  if (!response.ok) throw new Error(data.error || "Error de API");
  return data as T;
};
const daysSince = (date: string) => Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 86400000));
const formatDate = (date: string) => new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));

function Soul({ cycle, cleanDays, progress, name, soulStatus, onManage }: { cycle?: Cycle; cleanDays: number; progress: number; name: string; soulStatus: SoulState["soul_status"]; onManage: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const cycleLabel = cycle ? `Ciclo ${cycle.cycle_number}` : "Primer ciclo";
  const status = soulStatus === "dead" ? "Soul muerta" : cycle ? "Soul viva" : "Soul nueva";

  return <section className={`soul-stage ${expanded ? "is-expanded" : ""}`}>
    <motion.button
      className={`soul-orbit ${soulStatus === "dead" ? "is-dead" : ""}`}
      type="button"
      aria-expanded={expanded}
      aria-label={`${status}, ${cleanDays} días de pureza. ${expanded ? "Ocultar" : "Ver"} estadísticas`}
      onClick={() => setExpanded(value => !value)}
      whileTap={{ scale: .97 }}
      animate={{ scale: expanded ? 1.03 : 1 }}
      transition={{ duration: .35, ease: [0.4, 0, 0.2, 1] }}
    >
      <span className="soul-glow" />
      <span className="soul-core">
        <strong>{name}</strong>
        <small>{cycleLabel}</small>
      </span>
      <svg viewBox="0 0 260 260" aria-hidden="true">
        <circle className="soul-track" cx="130" cy="130" r="119" />
        <circle className="soul-progress" cx="130" cy="130" r="119" style={{ strokeDashoffset: 748 - (748 * progress) / 100 }} />
      </svg>
    </motion.button>
    <p className="soul-progress-label">{status} · {cleanDays} días de pureza</p>
    <AnimatePresence initial={false}>
      {expanded && <motion.div className="soul-stats" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .25, ease: [0.2, 0, 0, 1] }}>
        <div><span>Estado</span><strong>{status}</strong></div>
        <div><span>Ciclo</span><strong>{cycle?.cycle_number ?? 1}</strong></div>
        <div><span>Días de pureza</span><strong>{cleanDays}</strong></div>
        <div><span>Mínimo obligatorio</span><strong>{cycle?.min_clean_days ?? "—"}</strong></div>
        <div><span>Meta adicional</span><strong>{cycle ? `+${cycle.target_goal_days}` : "—"}</strong></div>
        <div><span>Inicio</span><strong>{cycle ? formatDate(cycle.start_date) : "Pendiente"}</strong></div>
        <button className="soul-manage-link" type="button" onClick={onManage}>Gestionar soul</button>
      </motion.div>}
    </AnimatePresence>
  </section>;
}

function Navigation({ view, setView }: { view: View; setView: (view: View) => void }) {
  return <nav className="navigation" aria-label="Secciones principales">
    {navItems.map(item => {
      const Icon = item.icon;
      return <button key={item.id} className={view === item.id ? "selected" : ""} onClick={() => setView(item.id)} aria-current={view === item.id ? "page" : undefined}>
        <Icon aria-hidden="true" /><span className="nav-long">{item.label}</span><span className="nav-short">{item.short}</span>
      </button>;
    })}
  </nav>;
}

function App() {
  const [userId, setUserId] = useState(localStorage.getItem("userId") || "");
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [soul, setSoul] = useState<SoulState>({ soul_name: "Soul", soul_status: "alive", soul_max_purity_days: 0 });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [view, setView] = useState<View>("dashboard");
  const [min, setMin] = useState("1"); const [goal, setGoalInput] = useState("2"); const [message, setMessage] = useState("");
  const [reflection, setReflection] = useState(""); const [feedback, setFeedback] = useState("");
  const [contactName, setContactName] = useState(""); const [contactEmail, setContactEmail] = useState("");
  const [apiOnline, setApiOnline] = useState(false);
  const activeCycle = useMemo(() => cycles.find(cycle => cycle.status === "active"), [cycles]);
  const cleanDays = activeCycle ? daysSince(activeCycle.start_date) : 0;
  const progress = activeCycle ? Math.min(100, Math.round((cleanDays / activeCycle.target_goal_days) * 100)) : 0;
  const load = () => {
    if (!userId) return;
    void api<{ cycles: Cycle[]; contacts: Contact[]; soul: SoulState }>("/state").then(data => { setCycles(data.cycles); setContacts(data.contacts); setSoul(data.soul); }).catch(error => setMessage(error.message));
  };
  useEffect(() => { load(); }, [userId]);
  useEffect(() => { void api<{ ok: boolean }>("/health").then(() => setApiOnline(true)).catch(() => setApiOnline(false)); }, []);
  async function createUser() {
    try { const data = await api<{ id: string }>("/users", { method: "POST", body: "{}" }); localStorage.setItem("userId", data.id); setUserId(data.id); setMessage("Tu espacio está listo. Define el primer ciclo."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo crear el perfil"); }
  }
  async function createCycle() {
    try { await api("/cycles", { method: "POST", body: JSON.stringify({ minCleanDays: Number(min), targetGoalDays: Number(goal) }) }); setMessage("Ciclo iniciado. El contador comienza ahora."); load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo crear el ciclo"); }
  }
  async function admitConsumption(id: string) {
    if (!confirm("Admitir consumir cerrará este ciclo. Si no superaste el mínimo, la soul morirá; si lo superaste, continuará con un mínimo penalizado. ¿Confirmas?")) return;
    try {
      const data = await api<{ soulStatus: string; nextMinCleanDays: number | null }>(`/cycles/${id}/admit-consumption`, { method: "POST", body: "{}" });
      setMessage(data.soulStatus === "dead" ? "La soul murió. Su historial queda conservado." : `La soul continúa. El próximo mínimo será ${data.nextMinCleanDays}.`);
      load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo registrar el consumo"); }
  }
  async function renameSoul() {
    const name = prompt("Nombre de la soul", soul.soul_name)?.trim();
    if (!name) return;
    try { await api("/soul/name", { method: "POST", body: JSON.stringify({ name }) }); setSoul(value => ({ ...value, soul_name: name })); setMessage("Nombre actualizado."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo renombrar la soul"); }
  }
  async function setGoal() {
    const value = Number(prompt("¿Cuántos días adicionales quieres establecer como meta?", String(activeCycle?.target_goal_days || 1)));
    if (!Number.isInteger(value) || value < 1) { setMessage("La meta adicional debe ser un número entero positivo."); return; }
    try { await api("/soul/goal", { method: "POST", body: JSON.stringify({ targetGoalDays: value }) }); setMessage("Meta adicional actualizada."); load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo actualizar la meta"); }
  }
  async function finish(id: string) {
    try {
      const data = await api<{ cleanDays: number; status: string; nextMinCleanDays: number | null }>(`/cycles/${id}/finish`, { method: "POST", body: "{}" });
      setMessage(`Ciclo cerrado: ${statusLabels[data.status] || data.status}. Lograste ${data.cleanDays} días. Próximo mínimo: ${data.nextMinCleanDays ?? "reinicio base"}.`); load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cerrar el ciclo"); }
  }
  async function defeat(id: string) {
    if (!confirm("Esto destruye toda la progresión acumulada. ¿Admitir derrota?")) return;
    try { await api(`/cycles/${id}/admit-defeat`, { method: "POST", body: "{}" }); setMessage("Derrota admitida. La siguiente secuencia puede comenzar desde 1 día."); load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo registrar el ciclo"); }
  }
  async function askCoach() {
    try { const data = await api<{ feedback: string }>("/coach/reflection", { method: "POST", body: JSON.stringify({ reflection }) }); setFeedback(data.feedback); setMessage("Tu reflexión recibió una perspectiva."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo consultar al Coach"); }
  }
  async function addContact() {
    try { await api("/contacts", { method: "POST", body: JSON.stringify({ name: contactName, email: contactEmail }) }); setContactName(""); setContactEmail(""); setMessage("Contacto añadido."); load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo añadir el contacto"); }
  }
  if (!userId) return <main className="onboarding"><div className="brand"><span className="brand-mark">A</span><span>Abstinencia</span></div><section className="welcome"><div className="onboarding-orbit"><span>01</span><i /><i /><i /></div><p className="eyebrow">VOLVER A TI</p><h1>La disciplina<br /><em>en calma.</em></h1><p className="welcome-copy">Un espacio privado para avanzar con intención, un día a la vez.</p><div className="onboarding-meta"><span>01</span><span>Privado · Local</span></div><ShimmerButton className="primary shimmer-cta" background="#19483d" shimmerColor="#e5b66f" onClick={createUser}>Entrar a mi espacio <ArrowUpRight aria-hidden="true" /></ShimmerButton></section></main>;
  const title = view === "dashboard" ? "Tu camino" : navItems.find(item => item.id === view)?.label;
  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">A</span><span>Abstinencia</span></div><div className="sidebar-context"><span className="context-dot" /> Espacio local</div><Navigation view={view} setView={setView} /><div className="sidebar-bottom"><div className={`connection ${apiOnline ? "online" : ""}`}><span /> {apiOnline ? "Sincronizado" : "Sin conexión"}</div><small>Tu proceso, a tu ritmo.</small></div></aside>
    <section className="content"><header className="topbar"><div><p className="eyebrow">BUEN DÍA</p><h1>{title}</h1></div><div className="topbar-status"><span className={`status-pip ${apiOnline ? "online" : ""}`} /> {apiOnline ? "Conectado" : "Modo local"}</div><button className="mobile-menu" aria-label="Abrir navegación"><Menu /></button></header><div className="mobile-nav"><Navigation view={view} setView={setView} /></div>
      <AnimatePresence mode="wait"><motion.div key={view} className="view-content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .28, ease: [0.2, 0, 0, 1] }}>
        {view === "dashboard" && <section className="dashboard">
          <Soul cycle={activeCycle} cleanDays={cleanDays} progress={progress} name={soul.soul_name} soulStatus={soul.soul_status} onManage={() => setView("soul")} />
        </section>}
        {view === "soul" && <section className="soul-management">
          <p className="eyebrow">GESTIÓN</p><h2>Cuida tu <em>soul.</em></h2>
          <p className="management-copy">Aquí puedes cambiar su nombre, establecer una meta adicional cuando la hayas alcanzado y admitir un consumo de forma consciente.</p>
          <div className="management-status"><span className={`status-pip ${soul.soul_status === "alive" ? "online" : ""}`} /> {soul.soul_status === "alive" ? "Soul viva" : "Soul muerta"} · {soul.soul_max_purity_days} días de pureza máxima</div>
          {activeCycle && <div className="management-actions">
            <button className="primary" onClick={() => admitConsumption(activeCycle.id)}>Admitir consumir</button>
            {cleanDays >= activeCycle.target_goal_days && <button className="quiet-button management-goal" onClick={setGoal}>Establecer nueva meta</button>}
            {soul.soul_status === "alive" && <button className="quiet-button" onClick={renameSoul}>Renombrar soul</button>}
          </div>}
          {!activeCycle && soul.soul_status === "alive" && <section className="cycle-form"><div className="field"><label htmlFor="min">Mínimo obligatorio</label><div className="input-wrap"><input id="min" type="number" min="1" value={min} onChange={e => setMin(e.target.value)} /></div></div><div className="field"><label htmlFor="goal">Meta adicional</label><div className="input-wrap"><input id="goal" type="number" min="1" value={goal} onChange={e => setGoalInput(e.target.value)} /></div></div><button className="primary" onClick={createCycle}>Iniciar ciclo <ArrowUpRight aria-hidden="true" /></button></section>}
          <section className="management-history"><h3>Historial de la soul</h3>{cycles.map(cycle => <div className="history-row" key={cycle.id}><span className={`history-index ${cycle.status}`}>{String(cycle.cycle_number).padStart(2, "0")}</span><div className="history-main"><strong>Ciclo {cycle.cycle_number}</strong><span>{cycle.min_clean_days} mínimo · +{cycle.target_goal_days} meta adicional</span></div><span className={`badge ${cycle.status}`}>{statusLabels[cycle.status] || cycle.status}</span></div>)}</section>
        </section>}
        {view === "coach" && <section className="feature-page"><div className="feature-intro"><p className="eyebrow">PAUSA</p><h2>Haz<br /><em>espacio.</em></h2><div className="feature-orbit"><Sparkles /></div></div><section className="reflection-panel"><label htmlFor="reflection">Tu reflexión</label><textarea id="reflection" rows={8} value={reflection} onChange={e => setReflection(e.target.value)} placeholder="Escribe aquí..." /><div className="panel-footer"><span className="character-count">{reflection.length}/10000</span><button className="primary" disabled={!reflection.trim()} onClick={askCoach}>Consultar <ArrowUpRight aria-hidden="true" /></button></div>{feedback && <div className="feedback"><span className="eyebrow">PERSPECTIVA</span><p>{feedback}</p></div>}</section></section>}
        {view === "contacts" && <section className="feature-page"><div className="feature-intro"><p className="eyebrow">RED DE APOYO</p><h2>Más<br /><em>acompañado.</em></h2><div className="support-constellation"><HeartHandshake /></div></div><section className="support-panel"><div className="contact-form"><div className="field"><label htmlFor="contact-name">Nombre</label><input id="contact-name" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nombre" /></div><div className="field"><label htmlFor="contact-email">Correo</label><input id="contact-email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="correo@ejemplo.com" /></div><button className="primary" disabled={!contactName.trim() || !contactEmail.trim()} onClick={addContact}>Añadir <Plus aria-hidden="true" /></button></div><div className="contact-list"><div className="list-heading"><span>CONTACTOS</span><span>{contacts.length}</span></div>{contacts.length === 0 ? <p className="empty-state">Aún no hay contactos</p> : contacts.map(contact => <div className="contact-row" key={contact.id}><span className="contact-avatar">{contact.contact_name.charAt(0).toUpperCase()}</span><div><strong>{contact.contact_name}</strong><span>{contact.contact_email}</span></div></div>)}</div></section></section>}
      </motion.div></AnimatePresence>
    </section>
    {message && <motion.div className="notice" role="status" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}><span>{message}</span><button aria-label="Cerrar aviso" onClick={() => setMessage("")}><X /></button></motion.div>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
window.addEventListener("online", () => { void flush(async (request: QueuedRequest) => { await api(request.path, request.options); }); });
