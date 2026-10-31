import { daysSince, localDate } from "../../domain/dates.js";

export { daysSince };
export const formatDate = (date: string) => new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date));
const longDateFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const formatLongDateParts = (date: string) => {
  const parts = Object.fromEntries(longDateFormatter.formatToParts(new Date(`${date}T12:00:00Z`)).map(part => [part.type, part.value]));
  const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  return {
    weekday: capitalize(parts.weekday ?? ""),
    day: parts.day ?? "",
    month: parts.month ?? "",
    year: parts.year ?? ""
  };
};
export const formatLongDate = (date: string) => {
  const parts = formatLongDateParts(date);
  return `${parts.weekday} ${parts.day} de ${parts.month} ${parts.year}`;
};
export const today = () => localDate();
