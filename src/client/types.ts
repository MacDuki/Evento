export type CycleStatus = "active" | "completed" | "failed";
export type SoulStatus = "alive" | "dead";

export type CycleGoal = { days: number; createdAt: string };
export type Cycle = {
  id: string;
  cycleNumber: number;
  minCleanDays: number;
  startDate: string;
  status: CycleStatus;
  finalCleanDays: number | null;
  deficitDays: number;
  endReason: string | null;
  endedAt: string | null;
  nextCycleId: string | null;
  plannedEndDate: string | null;
  goalDays: number | null;
  goals: CycleGoal[];
  cleanDays: number;
};

export type Soul = {
  id: string;
  name: string;
  status: SoulStatus;
  maxPurityDays: number;
  storedMaxPurityDays: number;
  createdAt: string;
  diedAt: string | null;
  cycles: Cycle[];
};

export type Contact = { id: string; contact_name: string; contact_email: string };
export type AppState = { today: string; soul: Soul | null; souls: Soul[]; contacts: Contact[] };
export type View = "dashboard" | "soul" | "coach" | "contacts" | "profile";
export type SoulReaction = "idle" | "awakening" | "success" | "progress" | "consumption" | "dead" | "rename" | "goal" | "color" | "effect" | "size";
export type OrbPalette = "ember" | "forest" | "ocean" | "violet";
export type OrbEffect = "liquid" | "calm" | "pulse";
export type OrbSettings = { palette: OrbPalette; effect: OrbEffect; size: number };
export type QueuedResult = { queued: true };
