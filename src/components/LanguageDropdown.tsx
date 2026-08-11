"use client";

import { useEffect, useState } from "react";
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
        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-200 transition hover:border-white/30 hover:text-white"
      >
        <Languages size={14} className="text-zinc-400" />
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
          <div className="absolute right-0 z-50 mt-2 max-h-72 w-52 overflow-y-auto rounded-xl border border-white/10 bg-[#12121a] p-1 shadow-xl">
            {locales.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLocale(l.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition hover:bg-white/5 ${
                  locale === l.code
                    ? "bg-white/10 text-white"
                    : "text-zinc-400"
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
