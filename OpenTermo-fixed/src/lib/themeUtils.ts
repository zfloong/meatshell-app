import type { ThemeId, ThemeOverride } from "@/stores/settingsStore";

type ThemeBases = Record<ThemeId, { glassR: number; glassG: number; glassB: number; borderIsLight: boolean }>;

const THEME_BASES: ThemeBases = {
  "deep-blue": { glassR: 26, glassG: 26, glassB: 26, borderIsLight: false },
  "light":     { glassR: 255, glassG: 255, glassB: 255, borderIsLight: true },
  "tabby":     { glassR: 26, glassG: 31, glassB: 39, borderIsLight: false },
};

/** Convert HSL to space-separated RGB string (for --accent-rgb style variables). */
function hslToRgbStr(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)      { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return `${Math.round((r + m) * 255)} ${Math.round((g + m) * 255)} ${Math.round((b + m) * 255)}`;
}

/** Apply a ThemeOverride to the DOM (CSS custom properties on <html>). */
export function applyOverride(theme: ThemeId, o: ThemeOverride) {
  const r = document.documentElement.style;
  const b = THEME_BASES[theme];

  // Accent
  const h = o.accentHue;
  r.setProperty("--accent", `hsl(${h}, 60%, 58%)`);
  r.setProperty("--accent-rgb", hslToRgbStr(h, 60, 58));
  const softH = (h + 20) % 360;
  r.setProperty("--accent-soft", `hsl(${softH}, 55%, 63%)`);
  r.setProperty("--accent-soft-rgb", hslToRgbStr(softH, 55, 63));
  r.setProperty("--accent-dim", `hsla(${h}, 60%, 58%, 0.14)`);
  r.setProperty("--accent-border", `hsla(${h}, 60%, 58%, 0.30)`);
  r.setProperty("--color-info", `hsl(${h}, 60%, 58%)`);

  // Glass — low opacity = bright veil, high opacity = dark solid
  // Preserve per-theme RGB tint (Tabby bluish, Dark neutral, Light white)
  const ga = Math.round(o.glassAlpha * 100) / 100;
  const brightR = Math.round(b.glassR + (1 - ga) * 200);
  const brightG = Math.round(b.glassG + (1 - ga) * 200);
  const brightB = Math.round(b.glassB + (1 - ga) * 200);
  r.setProperty("--bg-glass", `rgba(${brightR},${brightG},${brightB},${ga})`);
  const blurPx = Math.round(3 + ga * 16);
  r.setProperty("--glass-blur", `${blurPx}px`);

  // Borders
  const ba = Math.round(o.borderAlpha * 100) / 100;
  const bc = b.borderIsLight ? "0,0,0" : "255,255,255";
  r.setProperty("--border-subtle", `rgba(${bc},${(ba * 0.55).toFixed(2)})`);
  r.setProperty("--border-default", `rgba(${bc},${ba.toFixed(2)})`);
  r.setProperty("--border-strong", `rgba(${bc},${(ba * 1.4).toFixed(2)})`);
  r.setProperty("--scrollbar-thumb", `rgba(${bc},${(ba * 0.7).toFixed(2)})`);
  r.setProperty("--scrollbar-thumb-hover", `rgba(${bc},${(ba * 1.2).toFixed(2)})`);
}
