import { create } from "zustand";

export type ThemeId = "deep-blue" | "classic" | "light";

interface SettingsState {
  theme: ThemeId;
  fontSize: number;
  accentHue: number;         // 210 = blue, 260 = purple, 160 = green, 30 = orange
  glassOpacity: number;      // 0.5 - 0.95
  borderVisibility: number;  // 0.08 - 0.30 (multiplier for border alpha)
  setTheme: (t: ThemeId) => void;
  setFontSize: (s: number) => void;
  setAccentHue: (h: number) => void;
  setGlassOpacity: (o: number) => void;
  setBorderVisibility: (v: number) => void;
}

function loadTheme(): ThemeId {
  try {
    const v = localStorage.getItem("opentermo-theme");
    if (v === "classic" || v === "light") return v;
  } catch {}
  return "deep-blue";
}

function loadNumber(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return Number(v);
  } catch {}
  return fallback;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: loadTheme(),
  fontSize: loadNumber("opentermo-fontsize", 18),
  accentHue: loadNumber("opentermo-accent-hue", 210),
  glassOpacity: loadNumber("opentermo-glass-opacity", 0.78),
  borderVisibility: loadNumber("opentermo-border-visibility", 0.16),

  setTheme: (t) => {
    localStorage.setItem("opentermo-theme", t);
    set({ theme: t });
  },
  setFontSize: (s) => {
    const clamped = Math.max(12, Math.min(28, Math.round(s)));
    localStorage.setItem("opentermo-fontsize", String(clamped));
    set({ fontSize: clamped });
  },
  setAccentHue: (h) => {
    const clamped = Math.max(0, Math.min(360, Math.round(h)));
    localStorage.setItem("opentermo-accent-hue", String(clamped));
    set({ accentHue: clamped });
  },
  setGlassOpacity: (o) => {
    const clamped = Math.round(o * 100) / 100;
    localStorage.setItem("opentermo-glass-opacity", String(clamped));
    set({ glassOpacity: clamped });
  },
  setBorderVisibility: (v) => {
    const clamped = Math.round(v * 100) / 100;
    localStorage.setItem("opentermo-border-visibility", String(clamped));
    set({ borderVisibility: clamped });
  },
}));