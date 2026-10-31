import {
  AlertTriangle, ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronLeft,
  CircleDashed, CircleX, Clock3, Edit3, HeartPulse, Home, ImagePlus,
  LoaderCircle, Mail, Maximize2, MessageCircle, Minimize2, Palette, Plus,
  RotateCcw, Send, SlidersHorizontal, Sparkles, Trash2, Trophy, UserRound,
  Users, Waves, Wind, X
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
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
const navItems: { id: View; label: string; ariaLabel: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Hoy", ariaLabel: "Tu camino", icon: Home },
  { id: "soul", label: "Soul", ariaLabel: "Tu soul", icon: Sparkles },
  { id: "coach", label: "Coach", ariaLabel: "Coach", icon: MessageCircle },
  { id: "contacts", label: "Red", ariaLabel: "Red de apoyo", icon: Users },
  { id: "profile", label: "Yo", ariaLabel: "Perfil", icon: UserRound }
];
const orbEffects: { id: OrbEffect; label: string; icon: typeof Waves }[] = [
  { id: "liquid", label: "Líquido", icon: Waves },
  { id: "calm", label: "Calmo", icon: Wind },
  { id: "pulse", label: "Pulso", icon: HeartPulse }
];
type QueuedResult = { queued: true };
const isQueued = (value: unknown): value is QueuedResult => Boolean(value && typeof value === "object" && "queued" in value);
const api = async <T = Record<string, unknown>,>(path: string, options?: RequestInit, queueOnNetworkError = true): Promise<T | QueuedResult> => {
  const request = { headers: { "Content-Type": "application/json", "x-user-id": localStorage.getItem("userId") || "" }, ...options };
  let response: Response;
  try { response = await fetch(`/api${path}`, request); }
  catch (error) {
    if (queueOnNetworkError && options?.method && options.method !== "GET") { enqueue({ path, options: request }); return { queued: true }; }
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

function EmptySoulOrb() {
  return <div className="soul-orbit no-soul-orbit" aria-hidden="true">
    <span className="soul-orb-loader">
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
      <span className="soul-orb-box" />
    </span>
  </div>;
}

function NoSoul({ onCreate }: { onCreate: () => void }) {
  return <section className="no-soul-state">
    <h2 className="sr-only">Sin ciclo activo</h2>
    <EmptySoulOrb />
    <button className="primary empty-primary" type="button" onClick={onCreate}><span>Crear</span><Plus aria-hidden="true" /></button>
  </section>;
}

function CycleOnboarding({ soulName, setSoulName, min, setMin, goal, setGoalInput, startMode, setStartMode, startDate, setStartDate, endDate, setEndDate, onFinish, onExit }: {
  soulName: string; setSoulName: (value: string) => void; min: string; setMin: (value: string) => void; goal: string; setGoalInput: (value: string) => void;
  startMode: "now" | "past"; setStartMode: (value: "now" | "past") => void;
  startDate: string; setStartDate: (value: string) => void; endDate: string; setEndDate: (value: string) => void; onFinish: () => void; onExit: () => void;
}) {
  const [step, setStep] = useState(0);
  const labels = ["Nombra a tu soul", "Mínimo de días", "Meta de días", "Inicio"];
  const stepIcons = [Sparkles, CircleDashed, Trophy, CalendarDays];
  const StepIcon = stepIcons[step];
  const canContinue = step === 0 ? soulName.trim().length > 0 : step === 1 ? Number(min) > 0 : step === 2 ? Number(goal) > Number(min) : startMode === "now" ? Boolean(endDate && endDate >= today()) : Boolean(startDate && startDate <= today());
  const next = () => step < labels.length - 1 ? setStep(step + 1) : onFinish();
  return <main className="onboarding onboarding-flow">
    <div className="brand"><span className="sr-only">En calma</span></div>
    <section className="onboarding-card">
      <div className="onboarding-progress" aria-label={`Paso ${step + 1} de ${labels.length}: ${labels[step]}`}>
        <span className="sr-only">Paso {step + 1} de {labels.length}: {labels[step]}</span>
        <ol>{labels.map((label, index) => <li key={label} className={index <= step ? "is-active" : ""} aria-current={index === step ? "step" : undefined} />)}</ol>
      </div>
      <AnimatePresence mode="wait">
        <motion.div className="onboarding-step" key={step} initial={{ opacity: 0, x: 18, scale: .985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -12, scale: .985 }} transition={{ duration: .28, ease: [0.2, 0, 0, 1] }}>
          <div className="onboarding-step-icon" aria-hidden="true"><StepIcon /></div>
          <h1>{labels[step]}</h1>
          {step === 0 && <div className="field onboarding-field"><label className="sr-only" htmlFor="soul-name">Nombre de tu soul</label><input id="soul-name" autoFocus value={soulName} onChange={event => setSoulName(event.target.value)} placeholder="Aurora" /></div>}
          {step === 1 && <div className="field onboarding-field"><label className="sr-only" htmlFor="onboarding-min">Mínimo de días</label><input id="onboarding-min" aria-label="Mínimo de días" type="number" min="1" value={min} onChange={event => setMin(event.target.value)} /></div>}
          {step === 2 && <div className="field onboarding-field"><label className="sr-only" htmlFor="onboarding-goal">Meta de días</label><input id="onboarding-goal" aria-label="Meta de días" type="number" min="1" value={goal} onChange={event => setGoalInput(event.target.value)} /></div>}
          {step === 3 && <><div className="onboarding-start-options" role="group" aria-label="Inicio"><button className={`start-option ${startMode === "now" ? "selected" : ""}`} type="button" onClick={() => { setStartMode("now"); setStartDate(today()); }}><strong>Hoy</strong><Clock3 aria-hidden="true" /></button><button className={`start-option secondary ${startMode === "past" ? "selected" : ""}`} type="button" onClick={() => setStartMode("past")}><strong>Fecha</strong><CalendarDays aria-hidden="true" /></button></div>{startMode === "past" && <div className="date-reveal"><CalendarDays aria-hidden="true" /><label className="sr-only" htmlFor="onboarding-start">Fecha inicial</label><input id="onboarding-start" type="date" max={today()} value={startDate} onChange={event => setStartDate(event.target.value)} /></div>}</>}
        </motion.div>
      </AnimatePresence>
      <div className="onboarding-actions"><button className="icon-action quiet-icon" type="button" title={step === 0 ? "Salir" : "Anterior"} aria-label={step === 0 ? "Salir" : "Anterior"} onClick={() => step === 0 ? onExit() : setStep(current => current - 1)}>{step === 0 ? <X aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}</button><button className="primary onboarding-next" type="button" title={step === 3 ? "Crear ciclo" : "Siguiente"} aria-label={step === 3 ? "Crear ciclo" : "Siguiente"} disabled={!canContinue} onClick={next}>{step === 3 ? <><span>Crear</span><Check aria-hidden="true" /></> : <ArrowUpRight aria-hidden="true" />}</button></div>
    </section>
  </main>;
}

function Soul({ cycle, cleanDays, soulStatus, reaction, settings, onSettingsChange }: { cycle?: Cycle; cleanDays: number; soulStatus: SoulState["soul_status"]; reaction: SoulReaction; settings: OrbSettings; onSettingsChange: (patch: Partial<OrbSettings>) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const status = soulStatus === "dead" ? "Soul muerta" : cycle ? "Soul viva" : "Soul nueva";
  const palette = orbPalettes[settings.palette];
  const progress = cycle ? Math.min(100, Math.round((cleanDays / Math.max(cycle.target_goal_days, 1)) * 100)) : 0;
  const orbStyle = {
    "--color-one": palette.one,
    "--color-two": palette.two,
    "--color-three": palette.three,
    "--color-four": palette.four,
    "--color-five": palette.five,
    "--time-animation": settings.effect === "calm" ? "8s" : settings.effect === "pulse" ? "3s" : "5s",
    "--size": String(settings.size),
    "--progress": `${progress}%`
  } as React.CSSProperties;
  return <section className={`soul-stage ${expanded ? "is-expanded" : ""} ${customizing ? "is-customizing" : ""} select-none`} onPointerMove={event => { const bounds = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--pointer-x", `${((event.clientX - bounds.left) / bounds.width) * 100}%`); event.currentTarget.style.setProperty("--pointer-y", `${((event.clientY - bounds.top) / bounds.height) * 100}%`); }}>
    <header className="soul-stage-header"><h1 className="sr-only">{cycle ? "Tu camino" : "Tu espacio"}</h1><button className="orb-customizer-trigger" type="button" title="Personalizar" aria-label="Personalizar orbe" aria-expanded={customizing} onClick={() => setCustomizing(value => !value)}><SlidersHorizontal aria-hidden="true" /></button></header>
    <AnimatePresence>
      {customizing && <div className="orb-customizer-popover" role="group" aria-label="Personalizar orbe">
        <motion.div className="orb-float orb-float-color" initial={{ opacity: 0, scale: .4, x: 18, y: 12 }} animate={{ opacity: 1, scale: 1, x: 0, y: 0 }} exit={{ opacity: 0, scale: .4, x: 18, y: 12 }} transition={{ delay: .05, duration: .28 }}>
          <Palette aria-hidden="true" />
          <div className="orb-palette-options" role="radiogroup" aria-label="Color del orbe">
            {(Object.entries(orbPalettes) as [OrbPalette, typeof orbPalettes[OrbPalette]][]).map(([key, palette]) =>
              <button key={key} type="button" className={`orb-palette ${settings.palette === key ? "selected" : ""}`} style={{ "--swatch-one": palette.one, "--swatch-two": palette.two } as React.CSSProperties} aria-label={palette.label} aria-pressed={settings.palette === key} onPointerDown={event => event.stopPropagation()} onClick={() => onSettingsChange({ palette: key })}><span /></button>
            )}
          </div>
        </motion.div>
        <motion.div className="orb-float orb-float-effect" role="group" aria-label="Movimiento" initial={{ opacity: 0, scale: .4, x: -18, y: 12 }} animate={{ opacity: 1, scale: 1, x: 0, y: 0 }} exit={{ opacity: 0, scale: .4, x: -18, y: 12 }} transition={{ delay: .12, duration: .28 }}>
          {orbEffects.map(effect => { const EffectIcon = effect.icon; return <button key={effect.id} type="button" title={effect.label} aria-label={effect.label} aria-pressed={settings.effect === effect.id} onPointerDown={event => event.stopPropagation()} onClick={() => onSettingsChange({ effect: effect.id })}><EffectIcon aria-hidden="true" /></button>; })}
        </motion.div>
        <motion.div className="orb-float orb-float-size" initial={{ opacity: 0, scale: .4, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .4, y: 18 }} transition={{ delay: .19, duration: .28 }}>
          <Minimize2 aria-hidden="true" /><input aria-label="Tamaño del orbe" type="range" min="1.5" max="3" step="0.1" value={settings.size} onPointerDown={event => event.stopPropagation()} onChange={event => onSettingsChange({ size: Number(event.target.value) })} /><Maximize2 aria-hidden="true" />
        </motion.div>
        <button className="orb-customizer-close" type="button" aria-label="Cerrar personalizador" onPointerDown={event => event.stopPropagation()} onClick={() => setCustomizing(false)}><X aria-hidden="true" /></button>
      </div>}
    </AnimatePresence>
    <motion.button
      className={`soul-orbit orb-effect-${settings.effect} ${soulStatus === "dead" ? "is-dead" : ""} reaction-${reaction}`}
      style={orbStyle}
      type="button"
      aria-expanded={expanded}
      aria-label={`${status}, ${cleanDays} días de pureza. ${expanded ? "Ocultar" : "Ver"} estadísticas`}
      onClick={() => setExpanded(value => !value)}
      whileTap={{ scale: .97 }}
      animate={{ scale: 1 }}
      transition={{ duration: .35, ease: [0.4, 0, 0.2, 1] }}
    >
      <span className="orb-progress-ring" aria-hidden="true" />
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
      <span className="orb-readout" aria-hidden="true"><strong>{cleanDays}</strong><small>{cycle ? `/${cycle.target_goal_days}` : ""}</small></span>
    </motion.button>
    <AnimatePresence initial={false}>
      {expanded && <motion.div className="soul-stats" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .25, ease: [0.2, 0, 0, 1] }}>
        <div title="Ciclo"><CircleDashed aria-hidden="true" /><strong>{cycle?.cycle_number ?? 1}</strong><span className="sr-only">Ciclo {cycle?.cycle_number ?? 1}</span></div>
        <div title="Máximo"><Trophy aria-hidden="true" /><strong>{cleanDays}</strong><span className="sr-only">Máximo {cleanDays} días</span></div>
        <div title="Mínimo"><Check aria-hidden="true" /><strong>{cycle?.min_clean_days ?? "—"}</strong><span className="sr-only">Mínimo {cycle?.min_clean_days ?? "—"} días</span></div>
        <div title="Meta"><Sparkles aria-hidden="true" /><strong>{cycle?.target_goal_days ?? "—"}</strong><span className="sr-only">Meta {cycle?.target_goal_days ?? "—"} días</span></div>
        <div title={cycle ? `Inicio ${formatDate(cycle.start_date)}` : "Sin inicio"}><CalendarDays aria-hidden="true" /><time dateTime={cycle?.start_date}>{cycle ? formatDate(cycle.start_date) : "—"}</time></div>
      </motion.div>}
    </AnimatePresence>
  </section>;
}

function Navigation({ view, setView }: { view: View; setView: (view: View) => void }) {
  return <nav className="navigation" aria-label="Secciones principales">
    {navItems.map(item => {
      const Icon = item.icon;
      return <button key={item.id} type="button" aria-label={item.ariaLabel} className={view === item.id ? "selected" : ""} onClick={() => setView(item.id)} aria-current={view === item.id ? "page" : undefined}>
        <Icon aria-hidden="true" /><span className="nav-label">{item.label}</span>
      </button>;
    })}
  </nav>;
}

function App() {
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
  async function finish(id: string) {
    setPendingAction("finish");
    try {
      const data = await api<{ cleanDays: number; status: string; nextMinCleanDays: number | null }>(`/cycles/${id}/finish`, { method: "POST", body: "{}" });
      if (isQueued(data)) { showMessage("Evaluación pendiente", "info"); return; }
      setSoulReaction(data.status === "failed" ? "dead" : data.nextMinCleanDays && data.nextMinCleanDays > data.cleanDays + 1 ? "progress" : "success");
      showMessage(data.status === "failed" ? "Ciclo cerrado" : "Meta lograda"); load();
    } catch { showMessage("No se pudo evaluar", "error"); }
    finally { setPendingAction(""); }
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
          {activeCycle ? <><Soul cycle={activeCycle} cleanDays={cleanDays} soulStatus={soul.soul_status} reaction={soulReaction} settings={orbSettings} onSettingsChange={updateOrbSettings} /><section className="cycle-primary-action"><div className="next-days" title="Días para la meta"><CalendarDays aria-hidden="true" /><strong>{Math.max(0, activeCycle.target_goal_days - cleanDays)}</strong><span className="sr-only">días para la meta</span></div><button className="primary" type="button" title="Evaluar ciclo" aria-label="Evaluar ciclo" disabled={pendingAction === "finish"} onClick={() => void finish(activeCycle.id)}><span>Evaluar</span>{pendingAction === "finish" ? <LoaderCircle className="spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}</button></section></> : <NoSoul onCreate={() => setOnboarding(true)} />}
        </section>}
        {view === "soul" && <section className="soul-management">
          <header className="soul-management-head"><div className="soul-identity"><span className={`status-pip ${soul.soul_status === "alive" ? "online" : ""}`} aria-hidden="true" /><h2>{soul.soul_name}</h2><span className="sr-only">{soul.soul_status === "alive" ? "Viva" : "Muerta"}</span></div><div className="management-max" title="Máximo de días"><Trophy aria-hidden="true" /><strong>{soul.soul_max_purity_days}</strong><span className="sr-only">Máximo de {soul.soul_max_purity_days} días</span></div></header>
          {activeCycle && <div className="management-actions">
            <label className="event-date-field" title="Fecha de consumo"><CalendarDays aria-hidden="true" /><span className="sr-only">Fecha de consumo</span><input type="date" min={activeCycle.start_date.slice(0, 10)} value={consumptionDate} onChange={event => setConsumptionDate(event.target.value)} /></label>
            <button className="icon-action danger-icon" type="button" title="Admitir consumo" aria-label="Admitir consumo" disabled={pendingAction === "consumption"} onClick={() => setConfirming("consumption")}>{pendingAction === "consumption" ? <LoaderCircle className="spin" aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}</button>
            {soul.soul_status === "alive" && (isRenaming ? <form className="rename-form" onSubmit={event => { event.preventDefault(); void renameSoul(); }}><label className="sr-only" htmlFor="rename-soul">Nombre</label><input id="rename-soul" value={renameValue} maxLength={40} autoFocus onChange={event => setRenameValue(event.target.value)} /><div><button className="icon-action primary-icon" type="submit" title="Guardar" aria-label="Guardar" disabled={!renameValue.trim()}><Check aria-hidden="true" /></button><button className="icon-action quiet-icon" type="button" title="Cancelar" aria-label="Cancelar" onClick={() => setIsRenaming(false)}><X aria-hidden="true" /></button></div></form> : <button className="icon-action quiet-icon" type="button" title="Renombrar" aria-label="Renombrar" onClick={() => { setRenameValue(soul.soul_name); setIsRenaming(true); }}><Edit3 aria-hidden="true" /></button>)}
          </div>}
          {!activeCycle && soul.soul_status === "alive" && <button className="primary new-cycle" type="button" onClick={() => setOnboarding(true)}><span>Nuevo ciclo</span><Plus aria-hidden="true" /></button>}
          {cycles.length > 0 && <section className="management-history" aria-label="Historial de ciclos"><h3 className="sr-only">Historial</h3>{cycles.map(cycle => { const StatusIcon = cycle.status === "completed" ? CheckCircle2 : cycle.status === "failed" ? CircleX : CircleDashed; return <div className="history-row" key={cycle.id} aria-label={`Ciclo ${cycle.cycle_number}: ${statusLabels[cycle.status] || cycle.status}`}><span className={`history-index ${cycle.status}`}>{String(cycle.cycle_number).padStart(2, "0")}</span><strong className="history-range">{cycle.min_clean_days}<span aria-hidden="true">→</span>{cycle.target_goal_days}</strong><span className={`history-status ${cycle.status}`} title={statusLabels[cycle.status] || cycle.status}><StatusIcon aria-hidden="true" /><span className="sr-only">{statusLabels[cycle.status] || cycle.status}{cycle.planned_end_date ? `, ${formatDate(cycle.planned_end_date)}` : ""}</span></span></div>; })}</section>}
        </section>}
        {view === "coach" && <section className="coach-page"><section className="reflection-panel"><div className="composer-sigil" aria-hidden="true"><Sparkles /></div><label className="sr-only" htmlFor="reflection">Tu reflexión</label><textarea id="reflection" rows={8} maxLength={10000} value={reflection} onChange={e => setReflection(e.target.value)} placeholder="Escribí…" /><div className="panel-footer">{reflection.length > 9500 ? <span className="character-count" aria-live="polite">{reflection.length} / 10k</span> : <span />}<button className="primary" type="button" aria-label="Consultar coach" disabled={!reflection.trim() || pendingAction === "coach"} onClick={() => void askCoach()}><span>Enviar</span>{pendingAction === "coach" ? <LoaderCircle className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />}</button></div>{feedback && <details className="feedback" open><summary><Sparkles aria-hidden="true" /><span>Respuesta</span></summary><p>{feedback}</p></details>}</section></section>}
        {view === "contacts" && <section className="contacts-page"><header className="contacts-top"><div className="contact-cluster" aria-label={`${contacts.length} contactos`}>{contacts.length ? contacts.slice(0, 4).map(contact => <span className="cluster-avatar" key={contact.id}>{contact.contact_name.charAt(0).toUpperCase()}</span>) : <Users aria-hidden="true" />}</div><button className="icon-action primary-icon" type="button" title="Añadir contacto" aria-label="Añadir contacto" aria-expanded={contactFormOpen} onClick={() => setContactFormOpen(value => !value)}>{contactFormOpen ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}</button></header><AnimatePresence>{contactFormOpen && <motion.form className="contact-form" initial={{ opacity: 0, y: -8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: .98 }} transition={{ duration: .2, ease: [0.2, 0, 0, 1] }} onSubmit={event => { event.preventDefault(); void addContact(); }}><div className="field"><label className="sr-only" htmlFor="contact-name">Nombre</label><input id="contact-name" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nombre" /></div><div className="field"><label className="sr-only" htmlFor="contact-email">Correo</label><input id="contact-email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="correo@…" /></div><button className="icon-action primary-icon" type="submit" title="Añadir" aria-label="Añadir" disabled={!contactName.trim() || !contactEmail.trim() || pendingAction === "contact"}>{pendingAction === "contact" ? <LoaderCircle className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}</button></motion.form>}</AnimatePresence><section className="contact-list" aria-label="Contactos">{contacts.length === 0 ? <div className="contact-empty"><Users aria-hidden="true" /><span className="sr-only">No hay contactos</span></div> : contacts.map(contact => { const isExpanded = expandedContact === contact.id; return <button className={`contact-row ${isExpanded ? "is-expanded" : ""}`} type="button" key={contact.id} aria-expanded={isExpanded} aria-label={isExpanded ? `${contact.contact_name}, ${contact.contact_email}` : `Mostrar correo de ${contact.contact_name}`} onClick={() => setExpandedContact(current => current === contact.id ? null : contact.id)}><span className="contact-avatar" aria-hidden="true">{contact.contact_name.charAt(0).toUpperCase()}</span><span className="contact-name">{contact.contact_name}</span><Mail className="contact-mail" aria-hidden="true" /><span className="contact-email">{contact.contact_email}</span></button>; })}</section></section>}
        {view === "profile" && <section className="profile-page"><section className="profile-panel"><div className="profile-photo-row"><div className="profile-avatar">{profilePhoto ? <img src={profilePhoto} alt="Foto de perfil" /> : <UserRound aria-hidden="true" />}<label className="photo-upload" title="Cambiar foto"><ImagePlus aria-hidden="true" /><span className="sr-only">Cambiar foto</span><input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) saveProfilePhoto(file); event.target.value = ""; }} /></label></div></div><button className="danger-tile" type="button" onClick={() => setConfirming("delete")}><span>Borrar</span><Trash2 aria-hidden="true" /></button></section></section>}
      </motion.div></AnimatePresence>}
    </section>
    {confirming && <div className="confirm-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setConfirming(null); }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><AlertTriangle aria-hidden="true" /><h2 id="confirm-title">{confirming === "delete" ? "Borrar todo" : "Registrar consumo"}</h2><p id="confirm-description">{confirming === "delete" ? "No se puede deshacer." : "Cierra este ciclo."}</p><div className="confirm-actions"><button className="quiet-button" type="button" onClick={() => setConfirming(null)}>Volver</button><button className="danger-button" type="button" disabled={pendingAction !== ""} onClick={() => { if (confirming === "delete") void deleteUserData(); else if (activeCycle) void admitConsumption(activeCycle.id, consumptionDate); }}>{confirming === "delete" ? "Borrar" : "Registrar"}{pendingAction && <LoaderCircle className="spin" aria-hidden="true" />}</button></div></section></div>}
    {message && <motion.div className={`notice ${messageKind}`} role={messageKind === "error" ? "alert" : "status"} initial={{ opacity: 0, y: -14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}><NoticeIcon aria-hidden="true" /><span>{message}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setMessage("")}><X aria-hidden="true" /></button></motion.div>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
window.addEventListener("online", () => { void flush(async (request: QueuedRequest) => { await api(request.path, request.options); }); });
