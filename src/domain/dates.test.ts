import { describe, expect, it } from "vitest";
import { addCalendarDays, calendarDaysBetween, daysSince, isValidDateOnly, localDate } from "./dates.js";

describe("fechas de calendario local", () => {
  it("valida fechas reales en formato AAAA-MM-DD", () => {
    expect(isValidDateOnly("2024-02-29")).toBe(true);
    expect(isValidDateOnly("2026-02-29")).toBe(false);
    expect(isValidDateOnly("2026-13-01")).toBe(false);
    expect(isValidDateOnly("2026-04-31")).toBe(false);
    expect(isValidDateOnly("2026-4-1")).toBe(false);
    expect(isValidDateOnly("")).toBe(false);
  });

  it("construye la fecha local sin usar UTC", () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59, 59))).toBe("2026-01-05");
    expect(localDate(new Date(2026, 11, 31, 0, 0, 0))).toBe("2026-12-31");
  });

  it("calcula diferencias de días calendario", () => {
    expect(calendarDaysBetween("2026-10-01", "2026-10-01")).toBe(0);
    expect(calendarDaysBetween("2026-10-01", "2026-10-31")).toBe(30);
    expect(calendarDaysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("nunca devuelve días negativos al medir una racha", () => {
    expect(daysSince("2026-10-01", "2026-10-11")).toBe(10);
    expect(daysSince("2026-10-11", "2026-10-01")).toBe(0);
  });

  it("suma días atravesando meses, años y bisiestos", () => {
    expect(addCalendarDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addCalendarDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("rechaza fechas y cantidades inválidas", () => {
    expect(() => calendarDaysBetween("2026-02-30", "2026-03-01")).toThrow("fechas válidas");
    expect(() => addCalendarDays("2026-10-01", 1.5)).toThrow("entero");
  });
});
