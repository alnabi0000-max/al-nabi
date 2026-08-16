import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        nabi: {
          bg: "var(--nabi-bg)",
          card: "color-mix(in srgb, var(--nabi-bg) 82%, var(--nabi-card))",
          elevated: "color-mix(in srgb, var(--nabi-bg) 88%, var(--nabi-elevated))",
          border: "var(--nabi-border)",
          neon: "var(--nabi-neon)",
          gold: "var(--nabi-gold)",
          muted: "var(--nabi-muted)",
          ink: "var(--text-primary)",
          on: "var(--btn-on-accent)",
          surface: "var(--bg-elevated-solid)",
          input: "color-mix(in srgb, var(--nabi-bg) 85%, var(--input-bg))",
        },
      },
      backgroundImage: {
        "cinema-glow":
          "radial-gradient(ellipse 80% 50% at 20% -10%, var(--glow-1), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 10%, var(--glow-2), transparent 50%), radial-gradient(ellipse 50% 30% at 50% 100%, var(--glow-3), transparent 45%)",
        "cinema-accent":
          "linear-gradient(135deg, var(--accent-from) 0%, var(--accent-via) 50%, var(--accent-to) 100%)",
      },
      boxShadow: {
        neon: "var(--shadow-neon)",
        gold: "var(--shadow-gold)",
        glass: "var(--shadow-glass)",
        "cinema-ring": "var(--shadow-ring)",
      },
      dropShadow: {
        neon: "0 0 18px color-mix(in srgb, var(--accent) 40%, transparent)",
        gold: "0 0 18px color-mix(in srgb, var(--nabi-gold) 40%, transparent)",
      },
      fontFamily: {
        display: [
          "Segoe UI Variable Display",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.25, 1, 0.5, 1)",
      },
      keyframes: {
        "neon-border": {
          "0%, 100%": {
            boxShadow:
              "0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent), 0 0 24px color-mix(in srgb, var(--accent-from) 35%, transparent)",
          },
          "50%": {
            boxShadow:
              "0 0 0 1px color-mix(in srgb, var(--accent-to) 70%, transparent), 0 0 48px color-mix(in srgb, var(--accent-to) 45%, transparent)",
          },
        },
        "hero-expand": {
          from: { transform: "scale(1)" },
          to: { transform: "scale(1.01)" },
        },
      },
      animation: {
        "neon-border": "neon-border 2.2s ease-in-out infinite",
        "hero-expand": "hero-expand 0.35s ease-apple forwards",
      },
    },
  },
  plugins: [],
};

export default config;
