export type CycleStatus = "active" | "completed" | "failed";

export interface ConsumptionInput {
  minCleanDays: number;
  targetGoalDays: number | null;
  cleanDays: number;
}

export interface ConsumptionOutcome {
  status: "completed" | "failed";
  cleanDays: number;
  deficitDays: number;
  nextMinCleanDays: number | null;
  soulDies: boolean;
}

export interface GoalValidationInput {
  minCleanDays: number;
  currentGoalDays: number | null;
  cleanDays: number;
  newGoalDays: number;
}

const assertInteger = (value: number, name: string, minimum: number) => {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} debe ser un entero ${minimum === 0 ? "no negativo" : "positivo"}`);
  }
};

export function validateCycleDefinition(minCleanDays: number, targetGoalDays: number | null): void {
  assertInteger(minCleanDays, "El mínimo", 1);
  if (targetGoalDays !== null) {
    assertInteger(targetGoalDays, "La meta", 1);
    if (targetGoalDays <= minCleanDays) throw new Error("La meta debe ser mayor que el mínimo");
  }
}

/**
 * Regla de cierre por consumo:
 * - cleanDays <= mínimo -> fallo y muerte de la soul.
 * - cleanDays > mínimo -> cierre exitoso.
 *   El mínimo siguiente es el mayor entre los días logrados y la última meta, más uno.
 *   Sin meta, el mínimo siguiente es cleanDays + 1.
 */
export function evaluateConsumption(input: ConsumptionInput): ConsumptionOutcome {
  assertInteger(input.minCleanDays, "El mínimo", 1);
  assertInteger(input.cleanDays, "Los días limpios", 0);
  if (input.targetGoalDays !== null) {
    assertInteger(input.targetGoalDays, "La meta", 1);
    if (input.targetGoalDays <= input.minCleanDays) throw new Error("La meta debe ser mayor que el mínimo");
  }

  const deficitDays = input.targetGoalDays === null ? 0 : Math.max(0, input.targetGoalDays - input.cleanDays);

  if (input.cleanDays <= input.minCleanDays) {
    return {
      status: "failed",
      cleanDays: input.cleanDays,
      deficitDays,
      nextMinCleanDays: null,
      soulDies: true
    };
  }

  return {
    status: "completed",
    cleanDays: input.cleanDays,
    deficitDays,
    nextMinCleanDays: Math.max(input.cleanDays, input.targetGoalDays ?? 0) + 1,
    soulDies: false
  };
}

/**
 * Una meta nueva debe superar la racha actual y el mínimo.
 * Si ya existe una meta, solo se puede ampliar cuando fue alcanzada.
 */
export function validateGoal(input: GoalValidationInput): void {
  assertInteger(input.minCleanDays, "El mínimo", 1);
  assertInteger(input.cleanDays, "Los días limpios", 0);
  assertInteger(input.newGoalDays, "La nueva meta", 1);

  if (input.currentGoalDays !== null && input.cleanDays < input.currentGoalDays) {
    throw new Error("Todavía no alcanzaste la meta actual");
  }

  if (input.newGoalDays <= Math.max(input.cleanDays, input.minCleanDays)) {
    throw new Error("La nueva meta debe superar los días actuales y el mínimo");
  }
}
