import {
  ArrowUpRight, HeartHandshake, Home,
  ImagePlus, MessageCircle, Plus, Sparkles, Trash2, UserRound, Users, X
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ShimmerButton } from "../components/ui/shimmer-button.js";
import { enqueue, flush, type QueuedRequest } from "./offline.js";
import "./style.css";

type Cycle = { id: string; cycle_number: number; min_clean_days: number; target_goal_days: number; start_date: string; planned_end_date?: string | null; status: string; deficit_days?: number };
type SoulState = { soul_name: string; soul_status: "alive" | "dead"; soul_max_purity_days: number };
type Contact = { id: string; contact_name: string; contact_email: string };
type View = "dashboard" | "soul" | "coach" | "contacts" | "profile";
type SoulReaction = "idle" | "awakening" | "success" | "progress" | "consumption" | "dead" | "rename" | "goal" | "color" | "effect" | "size";
type OrbPalette = "ember" | "forest" | "ocean" | "violet";
type OrbEffect = "liquid" | "calm" | "pulse";
type OrbSettings = { palette: OrbPalette; effect: OrbEffect; size: number };
const defaultOrbSettings: OrbSettings = { palette: "ember", effect: "liquid", size: 2.2 };
const orbPalettes: Record<OrbPalette, { label: string; one: string; two: string; three: string; four: string; five: string }> = {
  ember: { label: "Ámbar", one: "#ffbf48", two: "#be4a1d", three: "#ffbf4780", four: "#bf4a1d80", five: "#ffbf4740" },
  forest: { label: "Bosque", one: "#d7edbe", two: "#3a8061", three: "#b6e68a99", four: "#235a4780", five: "#c9ef9850" },
  ocean: { label: "Océano", one: "#8ee7f5", two: "#1761a8", three: "#73d9f580", four: "#164d9c80", five: "#6edff540" },
  violet: { label: "Violeta", one: "#e5b7ff", two: "#7138a8", three: "#d396ff80", four: "#612b9580", five: "#d19aff40" }
};
const statusLabels: Record<string, string> = { active: "En curso", completed: "Completado", failed: "Fallido" };
const navItems: { id: View; label: string; short: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Mi camino", short: "Camino", icon: Home },
  { id: "soul", label: "Gestionar soul", short: "Soul", icon: Sparkles },
  { id: "coach", label: "Coach reflexivo", short: "Coach", icon: MessageCircle },
  { id: "contacts", label: "Red de apoyo", short: "Apoyo", icon: Users },
  { id: "profile", label: "Mi perfil", short: "Perfil", icon: UserRound }
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
const formatDate = (date: string) => new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date));
const localDate = (date: Date) => {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const today = () => localDate(new Date());
const dateAfter = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return localDate(date); };

function NoSoul({ onCreate }: { onCreate: () => void }) {
  return <section className="no-soul-state">
    <div className="no-soul-mark"><Sparkles aria-hidden="true" /></div>
    <p className="eyebrow">TU ESPACIO ESTÁ LISTO</p>
    <h2>Crea tu <em>soul.</em></h2>
    <p>Tu soul aparece cuando defines tu primer ciclo. Puedes comenzar hoy o elegir una fecha de inicio.</p>
    <button className="primary" type="button" onClick={onCreate}>Crear mi soul <ArrowUpRight aria-hidden="true" /></button>
  </section>;
}

function CycleOnboarding({ soulName, setSoulName, min, setMin, goal, setGoalInput, startMode, setStartMode, startDate, setStartDate, endDate, setEndDate, onFinish, onExit }: {
  soulName: string; setSoulName: (value: string) => void; min: string; setMin: (value: string) => void; goal: string; setGoalInput: (value: string) => void;
  startMode: "now" | "past"; setStartMode: (value: "now" | "past") => void;
  startDate: string; setStartDate: (value: string) => void; endDate: string; setEndDate: (value: string) => void; onFinish: () => void; onExit: () => void;
}) {
  const [step, setStep] = useState(0);
  const labels = ["Tu soul", "Mínimo", "Meta", "Fechas"];
  const canContinue = step === 0 ? soulName.trim().length > 0 : step === 1 ? Number(min) > 0 : step === 2 ? Number(goal) > Number(min) : startMode === "now" ? Boolean(endDate && endDate >= today()) : Boolean(startDate && startDate <= today());
  const next = () => step < labels.length - 1 ? setStep(step + 1) : onFinish();
  return <main className="onboarding onboarding-flow">
    <div className="brand"><span className="brand-mark">A</span><span>Abstinencia</span></div>
    <section className="onboarding-card">
      <div className="onboarding-progress"><span>PASO {String(step + 1).padStart(2, "0")} DE 04</span><strong>{labels[step]}</strong><div><i style={{ width: `${((step + 1) / 4) * 100}%` }} /></div></div>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .25, ease: [0.2, 0, 0, 1] }}>
          {step === 0 && <><p className="eyebrow">PRIMER PASO</p><h1>Nombra el espacio<br /><em>que te acompaña.</em></h1><p className="onboarding-copy">Tu soul será el reflejo de este proceso. Dale un nombre que te resulte cercano.</p><div className="field onboarding-field"><label htmlFor="soul-name">Nombre de tu soul</label><input id="soul-name" autoFocus value={soulName} onChange={event => setSoulName(event.target.value)} placeholder="Por ejemplo, Aurora" /></div></>}
          {step === 1 && <><p className="eyebrow">SEGUNDO PASO</p><h1>Define tu<br /><em>punto de cuidado.</em></h1><p className="onboarding-copy">¿Cuántos días limpios necesitas para considerar este ciclo superado?</p><div className="field onboarding-field"><label htmlFor="onboarding-min">Mínimo obligatorio</label><div className="input-wrap"><input id="onboarding-min" type="number" min="1" value={min} onChange={event => setMin(event.target.value)} /><span>DÍAS</span></div></div></>}
          {step === 2 && <><p className="eyebrow">TERCER PASO</p><h1>Elige una meta<br /><em>que te impulse.</em></h1><p className="onboarding-copy">Estos días se suman al mínimo como una meta adicional para este ciclo.</p><div className="field onboarding-field"><label htmlFor="onboarding-goal">Meta adicional</label><div className="input-wrap"><input id="onboarding-goal" type="number" min="1" value={goal} onChange={event => setGoalInput(event.target.value)} /><span>DÍAS</span></div></div></>}
          {step === 3 && <><p className="eyebrow">ÚLTIMO PASO</p><h1>Empieza<br /><em>con intención.</em></h1><p className="onboarding-copy">La opción principal comienza hoy. Si ya llevas días de proceso, puedes elegir una fecha anterior.</p><div className="onboarding-start-options"><button className={`start-option ${startMode === "now" ? "selected" : ""}`} type="button" onClick={() => { setStartMode("now"); setStartDate(today()); }}><strong>Comenzar hoy</strong><span>El contador empieza ahora.</span></button><button className={`start-option secondary ${startMode === "past" ? "selected" : ""}`} type="button" onClick={() => setStartMode("past")}><strong>Comenzar desde una fecha anterior</strong><span>Registra el inicio real de este proceso.</span></button></div>{startMode === "now" ? <div className="field onboarding-field"><label htmlFor="onboarding-end">Horizonte orientativo</label><input id="onboarding-end" type="date" min={today()} value={endDate} onChange={event => setEndDate(event.target.value)} /><small>Solo es una referencia visual; el servidor calcula los días hasta el momento real.</small></div> : <div className="field onboarding-field"><label htmlFor="onboarding-start">¿Desde qué fecha?</label><input id="onboarding-start" type="date" max={today()} value={startDate} onChange={event => setStartDate(event.target.value)} /><small>El ciclo se calculará desde esa fecha hasta hoy.</small></div>}</>}
        </motion.div>
      </AnimatePresence>
      <div className="onboarding-actions"><button className="quiet-button" type="button" onClick={onExit}>Salir por ahora</button><button className="primary" type="button" disabled={!canContinue} onClick={next}>{step === 3 ? "Crear mi ciclo" : "Continuar"} <ArrowUpRight aria-hidden="true" /></button></div>
    </section>
  </main>;
}

function Soul({ cycle, cleanDays, soulStatus, reaction, settings, onSettingsChange }: { cycle?: Cycle; cleanDays: number; soulStatus: SoulState["soul_status"]; reaction: SoulReaction; settings: OrbSettings; onSettingsChange: (patch: Partial<OrbSettings>) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const longPressTimer = React.useRef<number | null>(null);
  const longPressTriggered = React.useRef(false);
  const status = soulStatus === "dead" ? "Soul muerta" : cycle ? "Soul viva" : "Soul nueva";
  const palette = orbPalettes[settings.palette];
  const orbStyle = {
    "--color-one": palette.one,
    "--color-two": palette.two,
    "--color-three": palette.three,
    "--color-four": palette.four,
    "--color-five": palette.five,
    "--time-animation": settings.effect === "calm" ? "8s" : settings.effect === "pulse" ? "3s" : "5s",
    "--size": String(settings.size)
  } as React.CSSProperties;
  const startLongPress = () => {
    longPressTriggered.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      setCustomizing(true);
    }, 1000);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  return <section className={`soul-stage ${expanded ? "is-expanded" : ""} ${customizing ? "is-customizing" : ""} select-none`}>
    <AnimatePresence>
      {customizing && <div className="orb-customizer-popover" aria-label="Personalizar orbe">
        <motion.div className="orb-float orb-float-color" initial={{ opacity: 0, scale: .4, x: 18, y: 12 }} animate={{ opacity: 1, scale: 1, x: 0, y: 0 }} exit={{ opacity: 0, scale: .4, x: 18, y: 12 }} transition={{ delay: .05, duration: .28 }}>
          <span>Color</span>
          <div className="orb-palette-options" role="radiogroup" aria-label="Color del orbe">
            {(Object.entries(orbPalettes) as [OrbPalette, typeof orbPalettes[OrbPalette]][]).map(([key, palette]) =>
              <button key={key} type="button" className={`orb-palette ${settings.palette === key ? "selected" : ""}`} style={{ "--swatch-one": palette.one, "--swatch-two": palette.two } as React.CSSProperties} aria-label={palette.label} aria-pressed={settings.palette === key} onPointerDown={event => event.stopPropagation()} onClick={() => onSettingsChange({ palette: key })}><span /></button>
            )}
          </div>
        </motion.div>
        <motion.label className="orb-float orb-float-effect" initial={{ opacity: 0, scale: .4, x: -18, y: 12 }} animate={{ opacity: 1, scale: 1, x: 0, y: 0 }} exit={{ opacity: 0, scale: .4, x: -18, y: 12 }} transition={{ delay: .12, duration: .28 }}>
          <span>Efecto</span>
          <select value={settings.effect} onPointerDown={event => event.stopPropagation()} onChange={event => onSettingsChange({ effect: event.target.value as OrbEffect })}><option value="liquid">Líquido</option><option value="calm">Calmo</option><option value="pulse">Pulsante</option></select>
        </motion.label>
        <motion.label className="orb-float orb-float-size" initial={{ opacity: 0, scale: .4, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .4, y: 18 }} transition={{ delay: .19, duration: .28 }}>
          <span>Tamaño <strong>{Math.round(settings.size * 100 / 2.2)}%</strong></span>
          <input type="range" min="1.5" max="3" step="0.1" value={settings.size} onPointerDown={event => event.stopPropagation()} onChange={event => onSettingsChange({ size: Number(event.target.value) })} />
        </motion.label>
        <button className="orb-customizer-close" type="button" aria-label="Cerrar personalizador" onPointerDown={event => event.stopPropagation()} onClick={() => setCustomizing(false)}>×</button>
      </div>}
    </AnimatePresence>
    <motion.button
      className={`soul-orbit orb-effect-${settings.effect} ${soulStatus === "dead" ? "is-dead" : ""} reaction-${reaction}`}
      style={orbStyle}
      type="button"
      aria-expanded={expanded}
      aria-label={`${status}, ${cleanDays} días de pureza. ${expanded ? "Ocultar" : "Ver"} estadísticas`}
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onClick={() => {
        if (longPressTriggered.current) {
          longPressTriggered.current = false;
          return;
        }
        setExpanded(value => !value);
      }}
      whileTap={{ scale: .97 }}
      animate={{ scale: 1 }}
      transition={{ duration: .35, ease: [0.4, 0, 0.2, 1] }}
    >
      <span className="soul-orb-loader" aria-hidden="true">
        <svg width="100" height="100" viewBox="0 0 100 100" focusable="false">
          <defs>
            <mask id="clipping">
              <polygon points="0,0 100,0 100,100 0,100" fill="black" />
              <polygon points="25,25 75,25 50,75" fill="white" />
              <polygon points="50,25 75,75 25,75" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
            </mask>
          </defs>
        </svg>
        <span key={`${settings.palette}-${settings.effect}-${settings.size}-${reaction}`} className="soul-orb-box" />
      </span>
    </motion.button>
    <p className="soul-progress-label">{status} · {cleanDays} días de pureza</p>
    <AnimatePresence initial={false}>
      {expanded && <motion.div className="soul-stats" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .25, ease: [0.2, 0, 0, 1] }}>
        <div><span>Nivel</span><strong>{cycle?.cycle_number ?? 1}</strong></div>
        <div><span>Ciclo</span><strong>{cycle?.cycle_number ?? 1}</strong></div>
        <div><span>Días de pureza</span><strong>{cleanDays}</strong></div>
        <div><span>Mínimo obligatorio</span><strong>{cycle?.min_clean_days ?? "—"}</strong></div>
        <div><span>Meta</span><strong>{cycle ? `+${cycle.target_goal_days}` : "—"}</strong></div>
        <div><span>Inicio</span><strong>{cycle ? formatDate(cycle.start_date) : "Pendiente"}</strong></div>
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
  const [min, setMin] = useState("1"); const [goal, setGoalInput] = useState("2"); const [soulName, setSoulName] = useState("Aurora");
  const [startMode, setStartMode] = useState<"now" | "past">("now");
  const [startDate, setStartDate] = useState(today); const [endDate, setEndDate] = useState(() => dateAfter(7)); const [message, setMessage] = useState("");
  const [consumptionDate, setConsumptionDate] = useState(today);
  const [onboarding, setOnboarding] = useState(false);
  const [reflection, setReflection] = useState(""); const [feedback, setFeedback] = useState("");
  const [contactName, setContactName] = useState(""); const [contactEmail, setContactEmail] = useState("");
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
  const load = () => {
    if (!userId) return;
    void api<{ cycles: Cycle[]; contacts: Contact[]; soul: SoulState }>("/state").then(data => {
      setCycles(data.cycles); setContacts(data.contacts); setSoul(data.soul);
      setOnboarding(data.cycles.length === 0 && localStorage.getItem(`onboarding-exited-${userId}`) !== "true");
    }).catch(error => setMessage(error.message));
  };
  useEffect(() => { load(); }, [userId]);
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
    try { const data = await api<{ id: string }>("/users", { method: "POST", body: "{}" }); localStorage.setItem("userId", data.id); setUserId(data.id); setMessage("Tu espacio está listo. Define el primer ciclo."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo crear el perfil"); }
  }
  async function createCycle() {
    try {
      const cycleStart = startMode === "now" ? today() : startDate;
      const cycleEnd = startMode === "past" ? today() : endDate;
      if (!cycleStart || !cycleEnd || cycleEnd < cycleStart) { setMessage("Revisa las fechas del ciclo."); return; }
      await api("/cycles", { method: "POST", body: JSON.stringify({ minCleanDays: Number(min), targetGoalDays: Number(goal), startDate: cycleStart, endDate: cycleEnd }) });
      if (soulName.trim()) await api("/soul/name", { method: "POST", body: JSON.stringify({ name: soulName.trim() }) });
      localStorage.removeItem(`onboarding-exited-${userId}`);
      setOnboarding(false); setSoulReaction("awakening"); setMessage("Ciclo iniciado. El contador comienza ahora."); load();
    }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo crear el ciclo"); }
  }
  async function admitConsumption(id: string, eventDate: string) {
    if (!confirm("Admitir consumir cerrará este ciclo. Si no superaste el mínimo, la soul morirá; si lo superaste, continuará con un mínimo penalizado. ¿Confirmas?")) return;
    try {
      if (!eventDate) { setMessage("Indica la fecha del consumo."); return; }
      const data = await api<{ soulStatus: string; nextMinCleanDays: number | null }>(`/cycles/${id}/admit-consumption`, { method: "POST", body: JSON.stringify({ eventDate }) });
      setSoulReaction(data.soulStatus === "dead" ? "dead" : "consumption");
      setMessage(data.soulStatus === "dead" ? "La soul murió. Su historial queda conservado." : `La soul continúa. El próximo mínimo será ${data.nextMinCleanDays}.`);
      load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo registrar el consumo"); }
  }
  async function renameSoul() {
    const name = prompt("Nombre de la soul", soul.soul_name)?.trim();
    if (!name) return;
    try { await api("/soul/name", { method: "POST", body: JSON.stringify({ name }) }); setSoul(value => ({ ...value, soul_name: name })); setSoulReaction("rename"); setMessage("Nombre actualizado."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo renombrar la soul"); }
  }
  async function finish(id: string) {
    try {
      const data = await api<{ cleanDays: number; status: string; nextMinCleanDays: number | null }>(`/cycles/${id}/finish`, { method: "POST", body: "{}" });
      setSoulReaction(data.status === "failed" ? "dead" : data.nextMinCleanDays && data.nextMinCleanDays > data.cleanDays + 1 ? "progress" : "success");
      setMessage(`Ciclo cerrado: ${statusLabels[data.status] || data.status}. Lograste ${data.cleanDays} días. Próximo mínimo: ${data.nextMinCleanDays ?? "reinicio base"}.`); load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cerrar el ciclo"); }
  }
  async function askCoach() {
    try { const data = await api<{ feedback: string }>("/coach/reflection", { method: "POST", body: JSON.stringify({ reflection }) }); setFeedback(data.feedback); setMessage("Tu reflexión recibió una perspectiva."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo consultar al Coach"); }
  }
  async function addContact() {
    try { await api("/contacts", { method: "POST", body: JSON.stringify({ name: contactName, email: contactEmail }) }); setContactName(""); setContactEmail(""); setMessage("Contacto añadido."); load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo añadir el contacto"); }
  }
  function saveProfilePhoto(file: File) {
    if (!file.type.startsWith("image/")) { setMessage("Selecciona una imagen válida."); return; }
    if (file.size > 2_500_000) { setMessage("La foto debe pesar menos de 2,5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") { setMessage("No se pudo leer la foto."); return; }
      localStorage.setItem("abstinencia-profile-photo", reader.result);
      setProfilePhoto(reader.result);
      setMessage("Foto de perfil guardada en este dispositivo.");
    };
    reader.onerror = () => setMessage("No se pudo leer la foto.");
    reader.readAsDataURL(file);
  }
  async function deleteUserData() {
    if (!confirm("Se borrará tu historial, contactos, configuración y foto de perfil. Esta acción no se puede deshacer. ¿Continuar?")) return;
    try {
      await api("/users/me", { method: "DELETE" });
      localStorage.clear();
      setUserId("");
      setProfilePhoto("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo borrar tu información"); }
  }
  if (!userId) return <main className="onboarding"><div className="brand"><span className="brand-mark">A</span><span>Abstinencia</span></div><section className="welcome"><div className="onboarding-orbit"><span>01</span><i /><i /><i /></div><p className="eyebrow">VOLVER A TI</p><h1>La disciplina<br /><em>en calma.</em></h1><p className="welcome-copy">Un espacio privado para avanzar con intención, un día a la vez.</p><div className="onboarding-meta"><span>01</span><span>Privado · Local</span></div><ShimmerButton className="primary shimmer-cta" background="#19483d" shimmerColor="#e5b66f" onClick={createUser}>Entrar a mi espacio <ArrowUpRight aria-hidden="true" /></ShimmerButton></section></main>;
  if (onboarding) return <CycleOnboarding soulName={soulName} setSoulName={setSoulName} min={min} setMin={setMin} goal={goal} setGoalInput={setGoalInput} startMode={startMode} setStartMode={setStartMode} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} onFinish={createCycle} onExit={() => { localStorage.setItem(`onboarding-exited-${userId}`, "true"); setOnboarding(false); }} />;
  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">A</span><span>Abstinencia</span></div><Navigation view={view} setView={setView} /></aside>
    <section className="content"><div className="mobile-nav"><Navigation view={view} setView={setView} /></div>
      <AnimatePresence mode="wait"><motion.div key={view} className="view-content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .28, ease: [0.2, 0, 0, 1] }}>
        {view === "dashboard" && <section className="dashboard">
          {activeCycle ? <Soul cycle={activeCycle} cleanDays={cleanDays} soulStatus={soul.soul_status} reaction={soulReaction} settings={orbSettings} onSettingsChange={updateOrbSettings} /> : <NoSoul onCreate={() => setOnboarding(true)} />}
        </section>}
        {view === "soul" && <section className="soul-management">
          <p className="eyebrow">GESTIÓN</p><h2>Cuida tu <em>soul.</em></h2>
          <p className="management-copy">Aquí puedes cambiar su nombre y admitir un consumo de forma consciente. La meta queda fija al iniciar cada ciclo.</p>
          <div className="management-status"><span className={`status-pip ${soul.soul_status === "alive" ? "online" : ""}`} /> {soul.soul_status === "alive" ? "Soul viva" : "Soul muerta"} · {soul.soul_max_purity_days} días de pureza máxima</div>
          {activeCycle && <div className="management-actions">
            <label className="event-date-field">Fecha del consumo<input type="date" min={activeCycle.start_date.slice(0, 10)} value={consumptionDate} onChange={event => setConsumptionDate(event.target.value)} /></label>
            <button className="primary" onClick={() => admitConsumption(activeCycle.id, consumptionDate)}>Admitir consumir</button>
            {soul.soul_status === "alive" && <button className="quiet-button" onClick={renameSoul}>Renombrar soul</button>}
          </div>}
          {!activeCycle && soul.soul_status === "alive" && <button className="primary" type="button" onClick={() => setOnboarding(true)}>Configurar primer ciclo <ArrowUpRight aria-hidden="true" /></button>}
          <section className="management-history"><h3>Historial de la soul</h3>{cycles.map(cycle => <div className="history-row" key={cycle.id}><span className={`history-index ${cycle.status}`}>{String(cycle.cycle_number).padStart(2, "0")}</span><div className="history-main"><strong>Ciclo {cycle.cycle_number}</strong><span>{cycle.min_clean_days} mínimo · +{cycle.target_goal_days} meta adicional{cycle.planned_end_date ? ` · hasta ${formatDate(cycle.planned_end_date)}` : ""}</span></div><span className={`badge ${cycle.status}`}>{statusLabels[cycle.status] || cycle.status}</span></div>)}</section>
        </section>}
        {view === "coach" && <section className="feature-page"><div className="feature-intro"><p className="eyebrow">PAUSA</p><h2>Haz<br /><em>espacio.</em></h2><div className="feature-orbit"><Sparkles /></div></div><section className="reflection-panel"><label htmlFor="reflection">Tu reflexión</label><textarea id="reflection" rows={8} value={reflection} onChange={e => setReflection(e.target.value)} placeholder="Escribe aquí..." /><div className="panel-footer"><span className="character-count">{reflection.length}/10000</span><button className="primary" disabled={!reflection.trim()} onClick={askCoach}>Consultar <ArrowUpRight aria-hidden="true" /></button></div>{feedback && <div className="feedback"><span className="eyebrow">PERSPECTIVA</span><p>{feedback}</p></div>}</section></section>}
        {view === "contacts" && <section className="feature-page"><div className="feature-intro"><p className="eyebrow">RED DE APOYO</p><h2>Más<br /><em>acompañado.</em></h2><div className="support-constellation"><HeartHandshake /></div></div><section className="support-panel"><div className="contact-form"><div className="field"><label htmlFor="contact-name">Nombre</label><input id="contact-name" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nombre" /></div><div className="field"><label htmlFor="contact-email">Correo</label><input id="contact-email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="correo@ejemplo.com" /></div><button className="primary" disabled={!contactName.trim() || !contactEmail.trim()} onClick={addContact}>Añadir <Plus aria-hidden="true" /></button></div><div className="contact-list"><div className="list-heading"><span>CONTACTOS</span><span>{contacts.length}</span></div>{contacts.length === 0 ? <p className="empty-state">Aún no hay contactos</p> : contacts.map(contact => <div className="contact-row" key={contact.id}><span className="contact-avatar">{contact.contact_name.charAt(0).toUpperCase()}</span><div><strong>{contact.contact_name}</strong><span>{contact.contact_email}</span></div></div>)}</div></section></section>}
        {view === "profile" && <section className="profile-page"><div className="feature-intro"><p className="eyebrow">TU ESPACIO</p><h2>Mi<br /><em>perfil.</em></h2></div><section className="profile-panel"><div className="profile-photo-row"><div className="profile-avatar">{profilePhoto ? <img src={profilePhoto} alt="Foto de perfil" /> : <UserRound aria-hidden="true" />}</div><div><strong>Foto de perfil</strong><p>Se guarda únicamente en este dispositivo.</p><label className="photo-upload"><ImagePlus aria-hidden="true" /> Subir foto<input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) saveProfilePhoto(file); event.target.value = ""; }} /></label></div></div><div className="profile-divider" /><div className="profile-danger"><div><strong>Borrar mis datos</strong><p>Elimina tu historial, contactos, ajustes y datos guardados localmente.</p></div><button className="danger-button" onClick={deleteUserData}><Trash2 aria-hidden="true" /> Borrar datos</button></div></section></section>}
      </motion.div></AnimatePresence>
    </section>
    {message && <motion.div className="notice" role="status" initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}><span>{message}</span><button aria-label="Cerrar aviso" onClick={() => setMessage("")}><X /></button></motion.div>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
window.addEventListener("online", () => { void flush(async (request: QueuedRequest) => { await api(request.path, request.options); }); });
