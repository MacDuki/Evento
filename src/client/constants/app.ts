import { Diamond, Gem, HeartPulse, Home, Sparkles, Triangle, UserRound, Waves, Wind } from "lucide-react";
import type { OrbEffect, OrbPalette, OrbSettings, OrbVariant, View } from "../types.js";

export const defaultOrbSettings: OrbSettings = { palette: "neutral", effect: "liquid", size: 2.2, variant: "liquid" };
export const orbPalettes: Record<OrbPalette, { label: string; one: string; two: string; three: string; four: string; five: string; accent: string; accentStrong: string; accentSoft: string }> = {
  neutral: { label: "Niebla", one: "#f4f5f7", two: "#777f8b", three: "#eef1f780", four: "#62697580", five: "#d9dde340", accent: "#e5e8ed", accentStrong: "#ffffff", accentSoft: "rgba(232, 236, 243, .12)" },
  ice: { label: "Hielo", one: "#d9f7ff", two: "#398aa9", three: "#a8edff88", four: "#21627c88", five: "#89dff440", accent: "#a4eaff", accentStrong: "#e1faff", accentSoft: "rgba(147, 224, 247, .14)" },
  lavender: { label: "Lavanda", one: "#efdcff", two: "#7651a8", three: "#d7b0ff88", four: "#52337988", five: "#be8cff40", accent: "#d1b0ff", accentStrong: "#f3e8ff", accentSoft: "rgba(195, 157, 255, .14)" },
  cobalt: { label: "Cobalto", one: "#c4ddff", two: "#315dad", three: "#91beff88", four: "#203c7d88", five: "#6e9fff40", accent: "#9fc1ff", accentStrong: "#e2edff", accentSoft: "rgba(133, 173, 255, .14)" },
  amber: { label: "Ámbar", one: "#ffe2ae", two: "#a85e35", three: "#ffd18b88", four: "#793c2988", five: "#ffc26d40", accent: "#f2c273", accentStrong: "#fff0cf", accentSoft: "rgba(242, 194, 115, .14)" },
  rose: { label: "Rosa", one: "#ffd9e3", two: "#a64f6d", three: "#ffb5cc88", four: "#71324988", five: "#ff9fc040", accent: "#ffb4ca", accentStrong: "#ffe9f0", accentSoft: "rgba(255, 161, 191, .14)" }
};
export const statusLabels: Record<string, string> = { active: "En curso", completed: "Completado", failed: "Fallido" };
export const navItems: { id: View; label: string; ariaLabel: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Hoy", ariaLabel: "Tu camino", icon: Home },
  { id: "soul", label: "Soul", ariaLabel: "Tu soul", icon: Sparkles },
  { id: "profile", label: "Yo", ariaLabel: "Perfil", icon: UserRound }
];
export const orbEffects: { id: OrbEffect; label: string; icon: typeof Waves }[] = [
  { id: "liquid", label: "Fluido", icon: Waves },
  { id: "calm", label: "Calmo", icon: Wind },
  { id: "pulse", label: "Pulso", icon: HeartPulse }
];
export const orbVariants: { id: OrbVariant; label: string; icon: typeof Waves }[] = [
  { id: "liquid", label: "Líquido", icon: Waves },
  { id: "prism", label: "Prisma", icon: Gem },
  { id: "diamond", label: "Rombo", icon: Diamond },
  { id: "triangle", label: "Triángulo", icon: Triangle }
];
