import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, CalendarDays, Check, ChevronLeft, CircleDashed, Clock3, Sparkles, Trophy, X } from "lucide-react";
import { useState } from "react";
import { today } from "../../utils/dates.js";
export function CycleOnboarding({ soulName, setSoulName, min, setMin, goal, setGoalInput, startMode, setStartMode, startDate, setStartDate, endDate, setEndDate, onFinish, onExit }: {
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

