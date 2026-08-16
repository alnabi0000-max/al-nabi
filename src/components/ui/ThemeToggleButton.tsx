"use client";

import { Sparkles } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Icon-only theme cycle — one click advances to the next studio theme.
 * Persistence lives in ThemeProvider (localStorage).
 */
export function ThemeToggleButton() {
  const { theme, themes, setTheme } = useTheme();
  const { t } = useLanguage();
  const current = themes.find((item) => item.id === theme) ?? themes[0]!;

  function cycleTheme() {
    const index = themes.findIndex((item) => item.id === theme);
    const next = themes[(index + 1 + themes.length) % themes.length]!;
    setTheme(next.id);
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={t.header.theme}
      title={current.label}
      className="rounded-full border border-white/10 p-2 text-nabi-ink backdrop-blur-md transition-all hover:bg-white/10 hover:shadow-[0_0_18px_rgba(255,255,255,0.12)]"
    >
      <Sparkles size={16} strokeWidth={1.75} />
    </button>
  );
}
