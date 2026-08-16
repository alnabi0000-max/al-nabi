"use client";

import { Sparkles } from "lucide-react";
import { useCosmicTheme } from "@/context/CosmicThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { cosmicThemeLabel } from "@/lib/theme/cosmic";

/**
 * Icon-only cosmic theme cycle — one click, no popover.
 */
export function ThemeToggleButton() {
  const { theme, cycleTheme } = useCosmicTheme();
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={t.header.theme}
      title={cosmicThemeLabel(theme)}
      className="rounded-full border border-white/10 p-2 text-nabi-ink backdrop-blur-md transition-all hover:bg-white/10 hover:shadow-[0_0_18px_rgba(255,255,255,0.12)]"
    >
      <Sparkles size={16} strokeWidth={1.75} />
    </button>
  );
}
