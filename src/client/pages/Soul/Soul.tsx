import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, Check, CircleDashed, Maximize2, Minimize2, Palette, SlidersHorizontal, Sparkles, Trophy, Waves, Wind, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { orbEffects, orbPalettes } from "../../constants/app.js";
import { formatDate } from "../../utils/dates.js";
import type { Cycle, OrbPalette, OrbSettings, SoulReaction, SoulState } from "../../types.js";
export function Soul({ cycle, cleanDays, soulStatus, reaction, settings, onSettingsChange }: { cycle?: Cycle; cleanDays: number; soulStatus: SoulState["soul_status"]; reaction: SoulReaction; settings: OrbSettings; onSettingsChange: (patch: Partial<OrbSettings>) => void }) {
  const [expanded, setExpanded] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const orbRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
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

  useEffect(() => {
    const root = document.documentElement;
    const nav = document.querySelector<HTMLElement>(".mobile-nav");
    const updateOffset = () => root.style.setProperty("--soul-sheet-offset", `${nav?.getBoundingClientRect().height ?? 0}px`);
    updateOffset();
    const observer = nav ? new ResizeObserver(updateOffset) : null;
    if (nav && observer) observer.observe(nav);
    window.addEventListener("resize", updateOffset);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateOffset);
    };
  }, []);

  useEffect(() => {
    if (!expanded) return;
    document.body.classList.add("soul-sheet-open");
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus({ preventScroll: true }), 80);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
      document.body.classList.remove("soul-sheet-open");
      if (orbRef.current && document.body.contains(orbRef.current)) orbRef.current.focus({ preventScroll: true });
    };
  }, [expanded]);

  return <section className={`soul-stage ${expanded ? "is-expanded" : ""} select-none`} onPointerMove={event => { const bounds = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--pointer-x", `${((event.clientX - bounds.left) / bounds.width) * 100}%`); event.currentTarget.style.setProperty("--pointer-y", `${((event.clientY - bounds.top) / bounds.height) * 100}%`); }}>
    <motion.button
      ref={orbRef}
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
    {createPortal(<AnimatePresence initial={false}>
      {expanded && <React.Fragment key="soul-sheet">
        <motion.div className="soul-sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2, ease: [0.2, 0, 0, 1] }} onClick={() => setExpanded(false)} />
        <motion.section
          className="soul-sheet"
          role="dialog"
          aria-labelledby="soul-sheet-title"
          initial={{ y: reduceMotion ? 24 : "100%" }}
          animate={{ y: 0 }}
          exit={{ y: reduceMotion ? 24 : "100%" }}
          transition={reduceMotion ? { duration: .18, ease: [0.2, 0, 0, 1] } : { type: "spring", stiffness: 380, damping: 38, mass: .9 }}
        >
          <span className="soul-sheet-grabber" aria-hidden="true" />
          <header className="soul-sheet-head">
            <div><span className="soul-sheet-eyebrow">Soul</span><h2 id="soul-sheet-title">Estado del ciclo</h2></div>
            <button ref={closeButtonRef} className="soul-sheet-close" type="button" aria-label="Cerrar panel" onClick={() => setExpanded(false)}><X aria-hidden="true" /></button>
          </header>
          <div className="soul-stats soul-sheet-stats">
            <div><CircleDashed aria-hidden="true" /><span className="soul-stat-label">Ciclo</span><strong>{cycle?.cycle_number ?? 1}</strong></div>
            <div><Sparkles aria-hidden="true" /><span className="soul-stat-label">Días limpios</span><strong>{cleanDays}</strong></div>
            <div><Check aria-hidden="true" /><span className="soul-stat-label">Mínimo</span><strong>{cycle?.min_clean_days ?? "—"}</strong></div>
            <div><Trophy aria-hidden="true" /><span className="soul-stat-label">Meta</span><strong>{cycle?.target_goal_days ?? "—"}</strong></div>
            <div className="soul-stat-date"><CalendarDays aria-hidden="true" /><span className="soul-stat-label">Inicio</span><time dateTime={cycle?.start_date}>{cycle ? formatDate(cycle.start_date) : "—"}</time></div>
          </div>
        </motion.section>
      </React.Fragment>}
    </AnimatePresence>, document.body)}
  </section>;
}

export function SoulCustomizer({ settings, onSettingsChange }: { settings: OrbSettings; onSettingsChange: (patch: Partial<OrbSettings>) => void }) {
  const [open, setOpen] = useState(false);
  return <div className={`soul-customizer ${open ? "is-open" : ""}`}>
    <button className="orb-customizer-trigger" type="button" title="Personalizar soul" aria-label="Personalizar soul" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <SlidersHorizontal aria-hidden="true" /><span>Personalizar</span>
    </button>
    <AnimatePresence>
      {open && <motion.div className="soul-customizer-panel" role="group" aria-label="Personalizar soul" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .2 }}>
        <div className="customizer-panel-heading"><div><strong>Personalizar soul</strong><span>Ajustá su apariencia y movimiento</span></div><button type="button" aria-label="Cerrar personalizador" onClick={() => setOpen(false)}><X aria-hidden="true" /></button></div>
        <div className="customizer-control"><div className="customizer-label"><Palette aria-hidden="true" /><span>Color</span></div><div className="orb-palette-options" role="radiogroup" aria-label="Color del orbe">{(Object.entries(orbPalettes) as [OrbPalette, typeof orbPalettes[OrbPalette]][]).map(([key, palette]) => <button key={key} type="button" className={`orb-palette ${settings.palette === key ? "selected" : ""}`} style={{ "--swatch-one": palette.one, "--swatch-two": palette.two } as React.CSSProperties} aria-label={palette.label} aria-pressed={settings.palette === key} onClick={() => onSettingsChange({ palette: key })}><span /></button>)}</div></div>
        <div className="customizer-control"><div className="customizer-label"><Waves aria-hidden="true" /><span>Movimiento</span></div><div className="orb-effect-options" role="group" aria-label="Movimiento">{orbEffects.map(effect => { const EffectIcon = effect.icon; return <button key={effect.id} type="button" title={effect.label} aria-label={effect.label} aria-pressed={settings.effect === effect.id} onClick={() => onSettingsChange({ effect: effect.id })}><EffectIcon aria-hidden="true" /><span>{effect.label}</span></button>; })}</div></div>
        <label className="customizer-control customizer-size"><span className="customizer-label"><Minimize2 aria-hidden="true" /><span>Tamaño</span><Maximize2 aria-hidden="true" /></span><input aria-label="Tamaño del orbe" type="range" min="1.5" max="3" step="0.1" value={settings.size} onChange={event => onSettingsChange({ size: Number(event.target.value) })} /></label>
      </motion.div>}
    </AnimatePresence>
  </div>;
}
