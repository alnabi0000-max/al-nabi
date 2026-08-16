"use client";

import { useEffect, useId, useState } from "react";
import { useMaster } from "@/context/MasterControllerContext";
import { useLanguage } from "@/context/LanguageContext";
import { Languages } from "lucide-react";
import { useIsMounted } from "@/hooks/useIsMounted";

/**
 * Language switcher — Master owns persistence; LanguageProvider mirrors via event.
 */
export function LanguageDropdown() {
  const { locale, locales, setLocale } = useMaster();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const isMounted = useIsMounted();
  const menuId = useId();
  const current = locales.find((l) => l.code === locale);

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
        aria-label={t.header.language}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 rounded-full border border-nabi-border bg-nabi-card px-3 py-1.5 text-xs text-nabi-ink transition hover:border-[var(--accent)]/40"
      >
        <Languages size={14} className="text-nabi-muted" />
        {isMounted ? current?.native || "…" : "…"}
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
            id={menuId}
            role="listbox"
            aria-label={t.header.language}
            className="absolute right-0 z-50 mt-2 max-h-72 w-52 overflow-y-auto rounded-xl border border-nabi-border bg-nabi-surface p-1 shadow-xl"
          >
            {locales.map((l) => (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={locale === l.code}
                onClick={() => {
                  setLocale(l.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition hover:bg-nabi-elevated ${
                  locale === l.code
                    ? "bg-nabi-elevated text-nabi-ink"
                    : "text-nabi-muted"
                }`}
              >
                <span>{l.native}</span>
                <span className="text-[10px] opacity-50">
                  {l.code.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
