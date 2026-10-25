export type CycleStatus = "active" | "completed" | "failed";

export interface CycleInput {
  previousCleanDays: number;
  minCleanDays: number;
  targetGoalDays: number;
  cleanDays: number;
}

export interface CycleOutcome {
  status: CycleStatus;
  deficitDays: number;
  nextMinCleanDays: number | null;
  soulDies: boolean;
}

export function evaluateCycle(input: CycleInput): CycleOutcome {
  if (!Number.isInteger(input.previousCleanDays) || input.previousCleanDays < 0) {
    throw new Error("previousCleanDays debe ser un entero no negativo");
  }
  if (!Number.isInteger(input.minCleanDays) || input.minCleanDays < 1) {
    throw new Error("minCleanDays debe ser un entero positivo");
  }
  if (!Number.isInteger(input.targetGoalDays) || input.targetGoalDays <= input.minCleanDays) {
    throw new Error("targetGoalDays debe ser mayor que minCleanDays");
  }
  if (!Number.isInteger(input.cleanDays) || input.cleanDays < 0) {
    throw new Error("cleanDays debe ser un entero no negativo");
  }
  if (input.cleanDays >= input.targetGoalDays) {
    return { status: "completed", deficitDays: 0, nextMinCleanDays: null, soulDies: false };
  }
  if (input.cleanDays > input.minCleanDays) {
    const deficitDays = input.targetGoalDays - input.cleanDays;
    return {
      status: "completed",
      deficitDays,
      nextMinCleanDays: Math.max(input.previousCleanDays + 1, input.cleanDays + deficitDays + 1),
      soulDies: false
    };
  }
  return { status: "failed", deficitDays: 0, nextMinCleanDays: null, soulDies: true };
}

export function validateNewCycle(minCleanDays: number, targetGoalDays: number, previousMaxPurity: number): void {
  if (minCleanDays <= previousMaxPurity) throw new Error("El mínimo debe superar estrictamente la mayor pureza alcanzada");
  if (targetGoalDays < 1) throw new Error("La meta adicional debe ser positiva");
}
