"use client";

import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import clsx from "clsx";
import { useTheme } from "@/context/ThemeContext";
import { useIsMounted } from "@/hooks/useIsMounted";

/**
 * Compact color-theme picker — circles only; layout unchanged.
 */
export function ThemePicker() {
  const { theme, themes, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const isMounted = useIsMounted();
  const current = themes.find((t) => t.id === theme) || themes[0]!;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Tema"
        aria-expanded={open}
        title={current.label}
        className="flex items-center gap-1.5 rounded-full border border-nabi-border bg-nabi-card px-2.5 py-1.5 text-xs text-nabi-ink transition hover:border-nabi-neon/50"
      >
        <span
          className="h-3.5 w-3.5 rounded-full shadow-sm ring-1 ring-nabi-border"
          style={{
            background: `linear-gradient(135deg, ${current.swatch}, ${current.swatchEnd})`,
          }}
          aria-hidden
        />
        <Palette size={14} className="text-nabi-muted hidden sm:block" />
        <span className="hidden sm:inline max-w-[4.5rem] truncate">
          {isMounted ? current.label : "…"}
        </span>
      </button>

      {open && isMounted && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            aria-label="Tema"
            className="absolute right-0 z-50 mt-2 w-[15.5rem] rounded-xl border border-nabi-border bg-nabi-surface p-2 shadow-xl"
          >
            <p className="mb-2 px-1 text-[10px] uppercase tracking-wider text-nabi-muted">
              Tema
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {themes.map((t) => {
                const selected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    title={t.label}
                    onClick={() => {
                      setTheme(t.id);
                      setOpen(false);
                    }}
                    className={clsx(
                      "relative flex h-9 w-9 items-center justify-center rounded-full transition",
                      selected
                        ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-nabi-surface"
                        : "hover:scale-105"
                    )}
                  >
                    <span
                      className="h-7 w-7 rounded-full"
                      style={{
                        background: `linear-gradient(135deg, ${t.swatch}, ${t.swatchEnd})`,
                      }}
                    />
                    {selected && (
                      <Check
                        size={12}
                        className="absolute text-white drop-shadow"
                        strokeWidth={3}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 truncate px-1 text-[11px] text-[var(--text-primary)]">
              {current.label}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
