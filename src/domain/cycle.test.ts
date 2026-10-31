import { describe, expect, it } from "vitest";
import { evaluateConsumption, validateCycleDefinition, validateGoal } from "./cycle.js";

describe("definición de un ciclo", () => {
  it("acepta un ciclo sin meta", () => {
    expect(() => validateCycleDefinition(8, null)).not.toThrow();
  });

  it("rechaza una meta que no supera el mínimo", () => {
    expect(() => validateCycleDefinition(8, 8)).toThrow("La meta debe ser mayor que el mínimo");
    expect(() => validateCycleDefinition(8, 7)).toThrow("La meta debe ser mayor que el mínimo");
  });

  it("rechaza mínimos que no son enteros positivos", () => {
    expect(() => validateCycleDefinition(0, null)).toThrow("El mínimo");
    expect(() => validateCycleDefinition(2.5, null)).toThrow("El mínimo");
  });
});

describe("cierre por consumo", () => {
  it("cierra con éxito y calcula el próximo mínimo desde la meta", () => {
    expect(evaluateConsumption({ minCleanDays: 8, targetGoalDays: 12, cleanDays: 10 })).toEqual({
      status: "completed",
      cleanDays: 10,
      deficitDays: 2,
      nextMinCleanDays: 13,
      soulDies: false
    });
  });

  it("usa los días logrados cuando superan la meta", () => {
    expect(evaluateConsumption({ minCleanDays: 8, targetGoalDays: 12, cleanDays: 14 })).toMatchObject({
      status: "completed",
      deficitDays: 0,
      nextMinCleanDays: 15
    });
  });

  it("usa la última meta cuando fue ampliada por encima de los días logrados", () => {
    expect(evaluateConsumption({ minCleanDays: 8, targetGoalDays: 16, cleanDays: 14 })).toMatchObject({
      status: "completed",
      deficitDays: 2,
      nextMinCleanDays: 17
    });
  });

  it("funciona sin meta y calcula el próximo mínimo desde los días limpios", () => {
    expect(evaluateConsumption({ minCleanDays: 8, targetGoalDays: null, cleanDays: 10 })).toEqual({
      status: "completed",
      cleanDays: 10,
      deficitDays: 0,
      nextMinCleanDays: 11,
      soulDies: false
    });
  });

  it("falla en el límite exacto del mínimo", () => {
    expect(evaluateConsumption({ minCleanDays: 8, targetGoalDays: 12, cleanDays: 8 })).toEqual({
      status: "failed",
      cleanDays: 8,
      deficitDays: 4,
      nextMinCleanDays: null,
      soulDies: true
    });
  });

  it("falla por debajo del mínimo", () => {
    expect(evaluateConsumption({ minCleanDays: 8, targetGoalDays: null, cleanDays: 3 })).toMatchObject({
      status: "failed",
      deficitDays: 0,
      soulDies: true
    });
  });

  it("rechaza una meta inválida al evaluar", () => {
    expect(() => evaluateConsumption({ minCleanDays: 8, targetGoalDays: 8, cleanDays: 10 })).toThrow("La meta debe ser mayor que el mínimo");
  });
});

describe("fijar y ampliar metas", () => {
  it("permite fijar una meta cuando no existe", () => {
    expect(() => validateGoal({ minCleanDays: 8, currentGoalDays: null, cleanDays: 10, newGoalDays: 12 })).not.toThrow();
  });

  it("rechaza una meta que no supera los días actuales ni el mínimo", () => {
    expect(() => validateGoal({ minCleanDays: 8, currentGoalDays: null, cleanDays: 10, newGoalDays: 10 })).toThrow("debe superar");
    expect(() => validateGoal({ minCleanDays: 8, currentGoalDays: null, cleanDays: 4, newGoalDays: 8 })).toThrow("debe superar");
  });

  it("no permite ampliar antes de alcanzar la meta actual", () => {
    expect(() => validateGoal({ minCleanDays: 8, currentGoalDays: 12, cleanDays: 11, newGoalDays: 14 })).toThrow("Todavía no alcanzaste");
  });

  it("permite ampliar una meta ya alcanzada", () => {
    expect(() => validateGoal({ minCleanDays: 8, currentGoalDays: 12, cleanDays: 12, newGoalDays: 13 })).not.toThrow();
    expect(() => validateGoal({ minCleanDays: 8, currentGoalDays: 12, cleanDays: 14, newGoalDays: 16 })).not.toThrow();
  });
});
