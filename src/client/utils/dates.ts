export const daysSince = (date: string) => Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 86400000));
export const formatDate = (date: string) => new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date));
export const localDate = (date: Date) => {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
export const today = () => localDate(new Date());
export const dateAfter = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return localDate(date); };
