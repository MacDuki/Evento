import { CalendarDays, Check, CheckCircle2, ChevronDown, CircleDashed, CircleX, Maximize2, Minimize2, Palette, SlidersHorizontal, Sparkles, Target, Trophy, Waves, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ShinyText from "../../../components/effects/ShinyText.js";
import { DateCompass } from "../../components/date-compass/DateCompass.js";
import { orbEffects, orbPalettes, orbVariants, statusLabels } from "../../constants/app.js";
import soulQuotes from "../../data/soul-quotes.json" with { type: "json" };
import type { Cycle, OrbPalette, OrbSettings, SoulReaction, Soul as SoulType } from "../../types.js";
import { formatDate, formatLongDate, formatLongDateParts, today } from "../../utils/dates.js";

const exampleSoulQuotes = soulQuotes;
const LAST_QUOTE_KEY = "en-calma-last-quote";

function pickOpeningQuoteIndex(): number {
  if (exampleSoulQuotes.length <= 1) return 0;
  let last = -1;
  try {
    const stored = Number(localStorage.getItem(LAST_QUOTE_KEY));
    if (Number.isInteger(stored) && stored >= 0 && stored < exampleSoulQuotes.length) last = stored;
  } catch {
    // Sin almacenamiento disponible se elige una frase al azar.
  }
  const candidates = exampleSoulQuotes.map((_, index) => index).filter(index => index !== last);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
}

export function Soul({ soul, cycle, cleanDays, reaction, settings, onSettingsChange }: {
  soul: SoulType; cycle?: Cycle; cleanDays: number; reaction: SoulReaction; settings: OrbSettings; onSettingsChange: (patch: Partial<OrbSettings>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [quoteIndex, setQuoteIndex] = useState(pickOpeningQuoteIndex);
  const [quoteDirection, setQuoteDirection] = useState(1);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const orbRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const quotePointerStart = useRef<{ x: number; y: number } | null>(null);
  const quoteSwiped = useRef(false);
  const reduceMotion = useReducedMotion();
  const status = soul.status === "dead" ? "Soul muerta" : cycle ? "Soul viva" : "Soul nueva";
  const palette = orbPalettes[settings.palette];
  const selectedDateParts = formatLongDateParts(selectedDate);
  const progress = cycle?.goalDays ? Math.min(100, Math.round((cleanDays / Math.max(cycle.goalDays, 1)) * 100)) : 0;
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

  function changeQuote(direction = 1) {
    setQuoteDirection(direction);
    setQuoteIndex(current => (current + direction + exampleSoulQuotes.length) % exampleSoulQuotes.length);
  }

  function handleQuotePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    quotePointerStart.current = { x: event.clientX, y: event.clientY };
    quoteSwiped.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleQuotePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const start = quotePointerStart.current;
    quotePointerStart.current = null;
    if (!start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) > 42 && Math.abs(deltaX) > Math.abs(deltaY)) {
      quoteSwiped.current = true;
      changeQuote(deltaX < 0 ? 1 : -1);
    }
  }

  function handleQuoteClick() {
    if (quoteSwiped.current) {
      quoteSwiped.current = false;
      return;
    }
    changeQuote();
  }

  function toggleStats() {
    if (!expanded) {
      document.body.classList.add("soul-sheet-open");
      document.body.classList.remove("soul-sheet-closing");
      const nav = document.querySelector<HTMLElement>(".mobile-nav");
      if (nav) nav.inert = true;
    } else {
      document.body.classList.add("soul-sheet-closing");
    }
    setExpanded(value => !value);
  }

  function closeStats() {
    document.body.classList.add("soul-sheet-closing");
    setExpanded(false);
  }

  function finishSheetExit() {
    document.body.classList.remove("soul-sheet-open");
    document.body.classList.remove("soul-sheet-closing");
    const nav = document.querySelector<HTMLElement>(".mobile-nav");
    if (nav) nav.inert = false;
    if (orbRef.current && document.body.contains(orbRef.current)) orbRef.current.focus({ preventScroll: true });
  }

  useEffect(() => () => {
    document.body.classList.remove("soul-sheet-open");
    document.body.classList.remove("soul-sheet-closing");
    const nav = document.querySelector<HTMLElement>(".mobile-nav");
    if (nav) nav.inert = false;
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const nav = document.querySelector<HTMLElement>(".mobile-nav");
    if (nav) nav.inert = true;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { closeStats(); return; }
      if (event.key !== "Tab") return;
      const items = sheetRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus({ preventScroll: true }), 80);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [expanded]);

  useEffect(() => {
    setSelectedDate(today());
  }, [cycle?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(LAST_QUOTE_KEY, String(quoteIndex));
    } catch {
      // La frase igual cambia durante la sesión.
    }
  }, [quoteIndex]);

  return <section className={`soul-stage ${expanded ? "is-expanded" : ""} select-none`} style={orbStyle}>
    <header className="soul-stage-header date-topbar">
      <time dateTime={selectedDate} aria-live="polite">
        <span>{selectedDateParts.weekday}</span>
        <strong>{selectedDateParts.day}</strong>
        <span>de {selectedDateParts.month} {selectedDateParts.year}</span>
      </time>
    </header>
    <button
      className="soul-quote"
      type="button"
      aria-label={`Frase de ${exampleSoulQuotes[quoteIndex].author}. Activa para cambiar de frase.`}
      onClick={handleQuoteClick}
      onPointerDown={handleQuotePointerDown}
      onPointerUp={handleQuotePointerUp}
      onPointerCancel={() => { quotePointerStart.current = null; }}
    >
      <AnimatePresence initial={false} mode="wait" custom={quoteDirection}>
        <motion.span
          key={quoteIndex}
          className="soul-quote-content"
          custom={quoteDirection}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: quoteDirection * 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: quoteDirection * -18 }}
          transition={{ duration: reduceMotion ? .12 : .28, ease: [0.2, 0, 0, 1] }}
        >
          <span className="soul-quote-text">
            <ShinyText
              text={`“${exampleSoulQuotes[quoteIndex].text}”`}
              color="#aeb5c5"
              shineColor="#ffffff"
              speed={3}
              shineWidth={44}
              softness={.3}
              trigger="loop"
              delay={0}
              angle={120}
              bands={1}
              glow={0}
              direction="left"
              easing="smooth"
              pauseOnHover={false}
              disabled={reduceMotion ?? false}
              className="soul-quote-shiny"
            />
          </span>
          <span className="soul-quote-author">{exampleSoulQuotes[quoteIndex].author}</span>
        </motion.span>
      </AnimatePresence>
    </button>
    <motion.button
      ref={orbRef}
      className={`soul-orbit orb-effect-${settings.effect} orb-variant-${settings.variant} ${soul.status === "dead" ? "is-dead" : ""} reaction-${reaction}`}
      style={orbStyle}
      type="button"
      aria-expanded={expanded}
       aria-label={`${status}, ${cleanDays} días de pureza actuales. Fecha seleccionada: ${formatLongDate(selectedDate)}. ${expanded ? "Ocultar" : "Ver"} estadísticas`}
      onClick={toggleStats}
      whileTap={{ scale: .97 }}
      animate={{ scale: 1 }}
      transition={{ duration: .35, ease: [0.4, 0, 0.2, 1] }}
    >
      <span className="orb-progress-ring" aria-hidden="true" />
      <span className="soul-orb-loader" aria-hidden="true">
        <span key={`${settings.palette}-${settings.effect}-${settings.size}-${reaction}`} className="soul-orb-box" />
      </span>
      <span className="orb-readout" aria-hidden="true"><strong>{cleanDays}</strong><small>{cycle?.goalDays ? `/${cycle.goalDays}` : ""}</small></span>
    </motion.button>
      {cycle && <DateCompass cycleStartDate={cycle.startDate} onDateChange={setSelectedDate} />}
      {createPortal(<AnimatePresence initial={false} onExitComplete={finishSheetExit}>
      {expanded && <React.Fragment key="soul-sheet">
        <motion.div className="soul-sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: .2, ease: [0.2, 0, 0, 1] } }} exit={{ opacity: 0, transition: { duration: reduceMotion ? .14 : .36, ease: [0.32, 0, .7, 0] } }} onClick={closeStats} />
        <motion.section
          ref={sheetRef}
          className="soul-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="soul-sheet-title"
          initial={{ y: reduceMotion ? 24 : "100%" }}
          animate={{ y: 0, transition: reduceMotion ? { duration: .18, ease: [0.2, 0, 0, 1] } : { type: "spring", stiffness: 380, damping: 38, mass: .9 } }}
          exit={{ y: reduceMotion ? 24 : "100%", transition: reduceMotion ? { duration: .16, ease: [0.32, 0, .7, 0] } : { duration: .36, ease: [0.32, 0, .7, 0] } }}
        >
          <span className="soul-sheet-grabber" aria-hidden="true" />
           <header className="soul-sheet-head">
             <div><span className="soul-sheet-eyebrow" title={soul.name}>{soul.name}</span><h2 id="soul-sheet-title">{soul.status === "dead" ? "Memoria de la soul" : "Estado del ciclo"}</h2></div>
             <div className="soul-sheet-head-actions">
               <SoulCustomizer settings={settings} onSettingsChange={onSettingsChange} />
               <button ref={closeButtonRef} className="soul-sheet-close" type="button" aria-label="Cerrar panel" onClick={closeStats}><X aria-hidden="true" /></button>
             </div>
           </header>
           <div className="soul-stats soul-sheet-stats">
            <div><CircleDashed aria-hidden="true" /><span className="soul-stat-label">Ciclo</span><strong>{cycle?.cycleNumber ?? "—"}</strong></div>
            <div><Sparkles aria-hidden="true" /><span className="soul-stat-label">Días limpios</span><strong>{cleanDays}</strong></div>
            <div><Check aria-hidden="true" /><span className="soul-stat-label">Mínimo</span><strong>{cycle?.minCleanDays ?? "—"}</strong></div>
            <div><Target aria-hidden="true" /><span className="soul-stat-label">Meta</span><strong>{cycle?.goalDays ?? "—"}</strong></div>
            <div><Trophy aria-hidden="true" /><span className="soul-stat-label">Máximo</span><strong>{soul.maxPurityDays}</strong></div>
            <div className="soul-stat-date"><CalendarDays aria-hidden="true" /><span className="soul-stat-label">Inicio</span><time dateTime={cycle?.startDate}>{cycle ? formatDate(cycle.startDate) : "—"}</time></div>
           </div>
           {cycle && cycle.goals.length > 1 && <div className="soul-goal-history" aria-label="Historial de metas">
            <span>Metas fijadas</span>
            <div>{cycle.goals.map(goal => <span key={goal.createdAt + goal.days}>{goal.days} días</span>)}</div>
          </div>}
        </motion.section>
      </React.Fragment>}
    </AnimatePresence>, document.body)}
  </section>;
}

export function SoulMemory({ souls }: { souls: SoulType[] }) {
  const [selected, setSelected] = useState<string | null>(souls[0]?.id ?? null);
  return <section className="memory-section" aria-label="Memoria de souls">
    <header className="memory-head">
      <span className="eyebrow">Memoria</span>
      <span className="memory-count" aria-label={`${souls.length} souls archivadas`}>{souls.length}</span>
    </header>
    {souls.length === 0
      ? <p className="memory-empty">Todavía no hay souls archivadas. La memoria aparece cuando una soul muere.</p>
      : <div className="memory-list">{souls.map(item => {
        const open = selected === item.id;
        return <article className={`memory-soul ${open ? "is-open" : ""}`} key={item.id}>
          <button type="button" className="memory-soul-head" aria-expanded={open} onClick={() => setSelected(open ? null : item.id)}>
            <span className="memory-soul-mark" aria-hidden="true" />
            <span className="memory-soul-copy"><strong>{item.name}</strong><span>Máxima pureza {item.maxPurityDays} días{item.diedAt ? ` · ${formatDate(item.diedAt)}` : ""}</span></span>
            <ChevronDown aria-hidden="true" />
          </button>
          {open && <div className="memory-cycles">
            {item.cycles.length === 0
              ? <p className="memory-empty">Sin ciclos registrados.</p>
              : item.cycles.map(cycle => {
                const StatusIcon = cycle.status === "completed" ? CheckCircle2 : cycle.status === "failed" ? CircleX : CircleDashed;
                const days = cycle.status === "active" ? cycle.cleanDays : cycle.finalCleanDays ?? cycle.cleanDays;
                return <div className="memory-cycle" key={cycle.id}>
                  <span className={`history-index ${cycle.status}`}>{String(cycle.cycleNumber).padStart(2, "0")}</span>
                  <span className="memory-cycle-copy"><strong>{cycle.minCleanDays} <span aria-hidden="true">→</span> {cycle.goalDays ?? "sin meta"}</strong><span>{statusLabels[cycle.status] || cycle.status} · {days} días · {formatDate(cycle.startDate)}</span></span>
                  <span className={`history-status ${cycle.status}`} title={statusLabels[cycle.status] || cycle.status}><StatusIcon aria-hidden="true" /><span className="sr-only">{statusLabels[cycle.status] || cycle.status}</span></span>
                </div>;
              })}
          </div>}
        </article>;
      })}</div>}
  </section>;
}

export function SoulCustomizer({ settings, onSettingsChange }: { settings: OrbSettings; onSettingsChange: (patch: Partial<OrbSettings>) => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("appearance-open");
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab") return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("appearance-open");
      if (triggerRef.current && document.body.contains(triggerRef.current)) triggerRef.current.focus({ preventScroll: true });
    };
  }, [open]);

  return <>
    <div className={`soul-customizer ${open ? "is-open" : ""}`}>
      <button ref={triggerRef} className="orb-customizer-trigger" type="button" title="Personalizar apariencia" aria-label="Personalizar apariencia" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <SlidersHorizontal aria-hidden="true" /><span>Apariencia</span>
      </button>
    </div>
    {createPortal(<AnimatePresence initial={false}>
      {open && <>
        <motion.button className="appearance-scrim" type="button" aria-label="Cerrar apariencia" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? .12 : .22 }} />
        <motion.section ref={panelRef} className="soul-customizer-panel" role="dialog" aria-modal="true" aria-labelledby="appearance-title" initial={{ opacity: 0, y: reduceMotion ? 12 : 28, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduceMotion ? 12 : 20, scale: .99 }} transition={reduceMotion ? { duration: .14 } : { type: "spring", stiffness: 340, damping: 32 }}>
          <span className="appearance-grabber" aria-hidden="true" />
          <div className="customizer-panel-heading"><h2 id="appearance-title" className="sr-only">Personalización de la interfaz y el orbe</h2><button ref={closeRef} type="button" aria-label="Cerrar personalizador" onClick={() => setOpen(false)}><X aria-hidden="true" /></button></div>
          <div className="customizer-control">
            <div className="customizer-label"><Palette aria-hidden="true" /><span>Tono de la app</span></div>
            <div className="appearance-palette-options" role="group" aria-label="Tono de la app">
              {(Object.entries(orbPalettes) as [OrbPalette, typeof orbPalettes[OrbPalette]][]).map(([key, palette]) => <button key={key} type="button" className={`appearance-palette ${settings.palette === key ? "selected" : ""}`} style={{ "--swatch-one": palette.one, "--swatch-two": palette.two } as React.CSSProperties} aria-label={palette.label} aria-pressed={settings.palette === key} onClick={() => onSettingsChange({ palette: key })}><span /><small>{palette.label}</small></button>)}
            </div>
          </div>
          <div className="customizer-control">
            <div className="customizer-label"><Sparkles aria-hidden="true" /><span>Estilo del orbe</span></div>
            <div className="orb-variant-options" role="group" aria-label="Estilo del orbe">
              {orbVariants.map(variant => { const VariantIcon = variant.icon; return <button key={variant.id} type="button" className={`orb-variant-option ${settings.variant === variant.id ? "selected" : ""}`} aria-label={variant.label} aria-pressed={settings.variant === variant.id} onClick={() => onSettingsChange({ variant: variant.id })}><span className={`variant-preview orb-variant-${variant.id}`} aria-hidden="true"><i /></span><span>{variant.label}</span><VariantIcon aria-hidden="true" /></button>; })}
            </div>
          </div>
          <div className="customizer-control">
            <div className="customizer-label"><Waves aria-hidden="true" /><span>Movimiento</span></div>
            <div className="orb-effect-options" role="group" aria-label="Movimiento">{orbEffects.map(effect => { const EffectIcon = effect.icon; return <button key={effect.id} type="button" title={effect.label} aria-label={effect.label} aria-pressed={settings.effect === effect.id} onClick={() => onSettingsChange({ effect: effect.id })}><EffectIcon aria-hidden="true" /><span>{effect.label}</span></button>; })}</div>
          </div>
          <label className="customizer-control customizer-size"><span className="customizer-label"><Minimize2 aria-hidden="true" /><span>Tamaño</span><Maximize2 aria-hidden="true" /></span><input aria-label="Tamaño del orbe" type="range" min="1.5" max="3" step="0.1" value={settings.size} onChange={event => onSettingsChange({ size: Number(event.target.value) })} /></label>
          <button className="appearance-done" type="button" onClick={() => setOpen(false)}>Listo</button>
        </motion.section>
      </>}
    </AnimatePresence>, document.body)}
  </>;
}
