import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        nabi: {
          bg: "#090A0F",
          card: "rgba(255,255,255,0.05)",
          elevated: "rgba(255,255,255,0.08)",
          border: "rgba(255,255,255,0.10)",
          neon: "#a78bfa",
          gold: "#f0abfc",
          muted: "#94a3b8",
        },
      },
      backgroundImage: {
        "cinema-glow":
          "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(99,102,241,0.28), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(236,72,153,0.18), transparent 50%), radial-gradient(ellipse 50% 30% at 50% 100%, rgba(168,85,247,0.12), transparent 45%)",
        "cinema-accent":
          "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
      },
      boxShadow: {
        neon: "0 0 28px rgba(168, 85, 247, 0.35)",
        gold: "0 0 22px rgba(236, 72, 153, 0.35)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.45)",
        "cinema-ring":
          "0 0 0 1px rgba(255,255,255,0.08), 0 0 40px rgba(139,92,246,0.25)",
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
              "0 0 0 1px rgba(168,85,247,0.45), 0 0 24px rgba(99,102,241,0.35)",
          },
          "50%": {
            boxShadow:
              "0 0 0 1px rgba(236,72,153,0.7), 0 0 48px rgba(236,72,153,0.45)",
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
