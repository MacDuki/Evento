import { describe, expect, it } from "vitest";
import { evaluateCycle, validateNewCycle } from "./cycle.js";
describe("reglas de ciclos", () => {
  it("mantiene el ciclo abierto al completar la meta", () => expect(evaluateCycle({ previousCleanDays: 7, minCleanDays: 8, targetGoalDays: 10, cleanDays: 10 })).toMatchObject({ status: "completed", nextMinCleanDays: null, soulDies: false }));
  it("aplica el déficit", () => expect(evaluateCycle({ previousCleanDays: 7, minCleanDays: 8, targetGoalDays: 12, cleanDays: 10 })).toMatchObject({ deficitDays: 2, nextMinCleanDays: 13 }));
  it("falla si no supera el mínimo", () => expect(evaluateCycle({ previousCleanDays: 7, minCleanDays: 8, targetGoalDays: 12, cleanDays: 8 })).toMatchObject({ status: "failed", soulDies: true }));
  it("mantiene viva la soul cuando supera el mínimo", () => expect(evaluateCycle({ previousCleanDays: 7, minCleanDays: 8, targetGoalDays: 12, cleanDays: 10 })).toMatchObject({ status: "completed", soulDies: false, nextMinCleanDays: 13 }));
  it("rechaza una meta que no supera el mínimo", () => expect(() => validateNewCycle(8, 8, 0)).toThrow("La meta debe ser mayor que el mínimo"));
  it("rechaza un mínimo que retrocede respecto de la pureza histórica", () => expect(() => validateNewCycle(8, 12, 8)).toThrow("mayor pureza"));
});
