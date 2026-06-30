import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
        xs: "var(--radius-xs)",
        full: "var(--radius-full)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "SF Pro Text",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Source Code Pro",
          "Cascadia Code",
          "Consolas",
          "monospace",
        ],
      },
      keyframes: {
        "dialog-in": {
          from: { opacity: "0", transform: "scale(0.95) translateY(12px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "drop-in": {
          from: { opacity: "0", transform: "translateY(-6px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.92)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "dialog-in": "dialog-in var(--duration-slower) var(--ease-spring)",
        "drop-in": "drop-in var(--duration-slow) var(--ease-spring)",
        "slide-in-right": "slide-in-right var(--duration-base) var(--ease-out)",
        "slide-up": "slide-up var(--duration-base) var(--ease-out)",
        "fade-in": "fade-in var(--duration-base) var(--ease-default)",
        "scale-in": "scale-in var(--duration-slow) var(--ease-spring)",
        pulse: "pulse 1.5s infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
