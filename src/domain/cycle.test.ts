import { describe, expect, it } from "vitest";
import { evaluateCycle } from "./cycle.js";
describe("reglas de ciclos", () => {
  it("mantiene el ciclo abierto al completar la meta", () => expect(evaluateCycle({ previousCleanDays: 7, minCleanDays: 8, targetGoalDays: 10, cleanDays: 10 })).toMatchObject({ status: "completed", nextMinCleanDays: null, soulDies: false }));
  it("aplica el déficit", () => expect(evaluateCycle({ previousCleanDays: 7, minCleanDays: 8, targetGoalDays: 12, cleanDays: 10 })).toMatchObject({ deficitDays: 2, nextMinCleanDays: 13 }));
  it("falla si no supera el mínimo", () => expect(evaluateCycle({ previousCleanDays: 7, minCleanDays: 8, targetGoalDays: 12, cleanDays: 8 })).toMatchObject({ status: "failed", soulDies: true }));
  it("mantiene viva la soul cuando supera el mínimo", () => expect(evaluateCycle({ previousCleanDays: 7, minCleanDays: 8, targetGoalDays: 12, cleanDays: 10 })).toMatchObject({ status: "completed", soulDies: false, nextMinCleanDays: 13 }));
});
