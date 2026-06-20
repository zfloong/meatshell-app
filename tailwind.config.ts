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
      colors: {
        /* Catppuccin Mocha palette — mapped to Tailwind names */
        background: "#1E1E2E",
        foreground: "#CDD6F4",
        surface: "#313244",
        "surface-bright": "#45475A",
        primary: {
          DEFAULT: "#89B4FA",
          foreground: "#1E1E2E",
        },
        secondary: {
          DEFAULT: "#A6E3A1",
          foreground: "#1E1E2E",
        },
        muted: {
          DEFAULT: "#45475A",
          foreground: "#BAC2DE",
        },
        accent: {
          DEFAULT: "#45475A",
          foreground: "#CDD6F4",
        },
        destructive: {
          DEFAULT: "#F38BA8",
          foreground: "#1E1E2E",
        },
        border: "#45475A",
        input: "#45475A",
        ring: "#89B4FA",
        /* Extra Catppuccin tokens */
        error: "#F38BA8",
        warning: "#FAB387",
        info: "#94E2D5",
        "text-secondary": "#BAC2DE",
        hover: "rgba(137, 180, 250, 0.1)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: [
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Cascadia Code",
          "Consolas",
          "monospace",
        ],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
