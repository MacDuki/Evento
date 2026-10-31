import { daysSince, localDate } from "../../domain/dates.js";

export { daysSince };
export const formatDate = (date: string) => new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date));
export const today = () => localDate();
