import { HeartPulse, Home, MessageCircle, Sparkles, UserRound, Users, Waves, Wind } from "lucide-react";
import type { OrbEffect, OrbPalette, OrbSettings, View } from "../types.js";

export const defaultOrbSettings: OrbSettings = { palette: "ember", effect: "liquid", size: 2.2 };
export const orbPalettes: Record<OrbPalette, { label: string; one: string; two: string; three: string; four: string; five: string }> = {
  ember: { label: "Ámbar", one: "#ffbf48", two: "#be4a1d", three: "#ffbf4780", four: "#bf4a1d80", five: "#ffbf4740" },
  forest: { label: "Bosque", one: "#d7edbe", two: "#3a8061", three: "#b6e68a99", four: "#235a4780", five: "#c9ef9850" },
  ocean: { label: "Océano", one: "#8ee7f5", two: "#1761a8", three: "#73d9f580", four: "#164d9c80", five: "#6edff540" },
  violet: { label: "Violeta", one: "#e5b7ff", two: "#7138a8", three: "#d396ff80", four: "#612b9580", five: "#d19aff40" }
};
export const statusLabels: Record<string, string> = { active: "En curso", completed: "Completado", failed: "Fallido" };
export const navItems: { id: View; label: string; ariaLabel: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Hoy", ariaLabel: "Tu camino", icon: Home },
  { id: "soul", label: "Soul", ariaLabel: "Tu soul", icon: Sparkles },
  { id: "coach", label: "Coach", ariaLabel: "Coach", icon: MessageCircle },
  { id: "contacts", label: "Red", ariaLabel: "Red de apoyo", icon: Users },
  { id: "profile", label: "Yo", ariaLabel: "Perfil", icon: UserRound }
];
export const orbEffects: { id: OrbEffect; label: string; icon: typeof Waves }[] = [
  { id: "liquid", label: "Líquido", icon: Waves },
  { id: "calm", label: "Calmo", icon: Wind },
  { id: "pulse", label: "Pulso", icon: HeartPulse }
];
