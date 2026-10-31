import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { addCalendarDays, daysSince, localDate } from "../../../domain/dates.js";

const VISIBLE_RADIUS = 15;
const VISIBLE_DAYS = VISIBLE_RADIUS * 2 + 1;
const DEFAULT_STEP = 20;
const RETURN_TO_TODAY_DELAY = 2400;

function dateAtNoon(date: string) {
  return new Date(`${date}T12:00:00Z`);
}

function dateParts(date: string) {
  const value = dateAtNoon(date);
  return { day: value.getUTCDate(), weekday: value.getUTCDay() };
}

export function DateCompass({ cycleStartDate, onDateChange }: { cycleStartDate: string; onDateChange: (date: string) => void }) {
  const baseDateRef = useRef(localDate());
  const [selectedOffset, setSelectedOffset] = useState(0);
  const [step, setStep] = useState(DEFAULT_STEP);
  const [isDragging, setIsDragging] = useState(false);
  const [centerValue, setCenterValue] = useState(() => daysSince(cycleStartDate, localDate()));
  const scaleRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const selectedOffsetRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const releaseTimerRef = useRef<number | null>(null);
  const returnTimerRef = useRef<number | null>(null);
  const returnAnimationFrameRef = useRef<number | null>(null);
  const centerValueRef = useRef(centerValue);

  const todayDate = localDate();

  const visibleDays = useMemo(() => Array.from({ length: VISIBLE_DAYS }, (_, index) => {
    const relativeOffset = index - VISIBLE_RADIUS;
    const absoluteOffset = selectedOffset + relativeOffset;
    const date = addCalendarDays(baseDateRef.current, absoluteOffset);
    const parts = dateParts(date);
    return {
      date,
      relativeOffset,
      day: parts.day,
      isMonthStart: parts.day === 1,
      isWeekStart: parts.weekday === 1,
      isToday: date === todayDate
    };
  }), [selectedOffset, todayDate]);

  useEffect(() => {
    const element = scaleRef.current;
    if (!element) return;

    const measure = () => {
      const nextStep = Math.min(28, Math.max(18, element.clientWidth * 0.06));
      setStep(nextStep);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current);
    if (returnTimerRef.current !== null) window.clearTimeout(returnTimerRef.current);
    if (returnAnimationFrameRef.current !== null) window.cancelAnimationFrame(returnAnimationFrameRef.current);
  }, []);

  const setTrackPosition = (position: number) => {
    if (trackRef.current) trackRef.current.style.transform = `translate3d(${position}px, 0, 0)`;
  };

  const updateCenterValue = (value: number) => {
    centerValueRef.current = value;
    setCenterValue(value);
  };

  const commitOffset = (nextOffset: number) => {
    const nextDate = addCalendarDays(baseDateRef.current, nextOffset);
    selectedOffsetRef.current = nextOffset;
    setSelectedOffset(nextOffset);
    updateCenterValue(daysSince(cycleStartDate, nextDate));
    onDateChange(nextDate);
  };

  const cancelReturnToToday = () => {
    if (returnTimerRef.current !== null) window.clearTimeout(returnTimerRef.current);
    if (returnAnimationFrameRef.current !== null) window.cancelAnimationFrame(returnAnimationFrameRef.current);
    returnTimerRef.current = null;
    returnAnimationFrameRef.current = null;
  };

  const returnToToday = () => {
    const distance = selectedOffsetRef.current;
    if (distance === 0) return;

    const track = trackRef.current;
    const duration = Math.min(1800, Math.max(360, 260 + Math.abs(distance) * 28));
    const targetValue = daysSince(cycleStartDate, baseDateRef.current);
    const startingValue = centerValueRef.current;
    const startedAt = performance.now();
    if (track) track.style.transition = "none";
    setTrackPosition(0);

    const animateReturn = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const continuousOffset = distance * (1 - easedProgress);
      const nextOffset = Math.round(continuousOffset);

      if (nextOffset !== selectedOffsetRef.current) {
        const nextDate = addCalendarDays(baseDateRef.current, nextOffset);
        selectedOffsetRef.current = nextOffset;
        setSelectedOffset(nextOffset);
        onDateChange(nextDate);
      }
      setTrackPosition((nextOffset - continuousOffset) * step);
      updateCenterValue(Math.round(startingValue + (targetValue - startingValue) * easedProgress));

      if (progress < 1) {
        returnAnimationFrameRef.current = window.requestAnimationFrame(animateReturn);
        return;
      }

      commitOffset(0);
      if (track) track.style.transition = "none";
      setTrackPosition(0);
      returnAnimationFrameRef.current = null;
    };

    returnAnimationFrameRef.current = window.requestAnimationFrame(animateReturn);
  };

  const finishDrag = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (!trackRef.current) return;
    trackRef.current.style.transition = "transform 260ms cubic-bezier(.2, 0, 0, 1)";
    setTrackPosition(0);
    releaseTimerRef.current = window.setTimeout(() => {
      if (trackRef.current) trackRef.current.style.transition = "";
    }, 280);
    cancelReturnToToday();
    returnTimerRef.current = window.setTimeout(returnToToday, RETURN_TO_TODAY_DELAY);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    cancelReturnToToday();
    if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current);
    if (trackRef.current) {
      trackRef.current.style.transition = "none";
      setTrackPosition(0);
    }
    updateCenterValue(daysSince(cycleStartDate, addCalendarDays(baseDateRef.current, selectedOffsetRef.current)));
    dragStartXRef.current = event.clientX;
    dragStartOffsetRef.current = selectedOffsetRef.current;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    event.preventDefault();
    const rawDistance = event.clientX - dragStartXRef.current;
    const movedDays = Math.round(rawDistance / step);
    const nextOffset = dragStartOffsetRef.current - movedDays;
    const residual = rawDistance - movedDays * step;
    if (nextOffset !== selectedOffsetRef.current) commitOffset(nextOffset);
    setTrackPosition(residual);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    finishDrag();
  };

  const moveWithKeyboard = (amount: number) => {
    if (amount === 0) return;
    commitOffset(selectedOffsetRef.current + amount);
    if (trackRef.current) {
      trackRef.current.style.transition = "transform 220ms cubic-bezier(.2, 0, 0, 1)";
      setTrackPosition(0);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const amount = event.key === "ArrowLeft" ? -1
      : event.key === "ArrowRight" ? 1
        : event.key === "PageUp" ? -7
          : event.key === "PageDown" ? 7
            : event.key === "Home" ? -selectedOffsetRef.current
              : 0;
    if (amount === 0) return;
    event.preventDefault();
    moveWithKeyboard(amount);
  };

  return <section className="date-compass" aria-label="Navegador de fechas">
      <span className="date-compass-center-value" aria-live="polite">{centerValue}</span>
    <div
      ref={scaleRef}
      className={`date-compass-scale ${isDragging ? "is-dragging" : ""}`}
      role="group"
      tabIndex={0}
      aria-label="Escala horizontal de fechas. Usa las flechas para moverte día a día."
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={finishDrag}
      style={{ "--date-step": `${step}px` } as CSSProperties}
    >
      <div className="date-compass-edge date-compass-edge-left" aria-hidden="true" />
      <div className="date-compass-edge date-compass-edge-right" aria-hidden="true" />
      <div ref={trackRef} className="date-compass-track">
        {visibleDays.map(item => <div
          className={`date-compass-day ${item.isWeekStart ? "is-week-start" : ""} ${item.isMonthStart ? "is-month-start" : ""} ${item.relativeOffset === 0 ? "is-selected" : ""} ${item.isToday ? "is-today" : ""}`}
          key={item.date}
          aria-hidden="true"
        >
          <span className="date-compass-tick" />
          {(item.isWeekStart || item.isMonthStart || item.relativeOffset === 0) && <span className="date-compass-tick-label">{item.day}</span>}
        </div>)}
      </div>
      <div className="date-compass-cursor" aria-hidden="true"><span /></div>
    </div>

  </section>;
}
