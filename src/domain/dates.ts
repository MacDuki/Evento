const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const parts = (value: string): [number, number, number] => {
  const match = DATE_ONLY.exec(value);
  if (!match) throw new Error("Usa una fecha válida (AAAA-MM-DD)");
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

export function isValidDateOnly(value: string): boolean {
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function localDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Diferencia de días calendario. Positiva si end es posterior a start. */
export function calendarDaysBetween(start: string, end: string): number {
  if (!isValidDateOnly(start) || !isValidDateOnly(end)) throw new Error("Usa fechas válidas (AAAA-MM-DD)");
  const [startYear, startMonth, startDay] = parts(start);
  const [endYear, endMonth, endDay] = parts(end);
  const startTime = Date.UTC(startYear, startMonth - 1, startDay);
  const endTime = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((endTime - startTime) / 86_400_000);
}

export function daysSince(start: string, end = localDate()): number {
  return Math.max(0, calendarDaysBetween(start, end));
}

export function addCalendarDays(date: string, days: number): string {
  if (!Number.isInteger(days)) throw new Error("Los días deben ser un entero");
  const [year, month, day] = parts(date);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
}
