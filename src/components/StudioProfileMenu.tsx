"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useMaster } from "@/context/MasterControllerContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatCredits } from "@/lib/credits";

/**
 * Header: NC balance + profile dropdown.
 */
export function StudioProfileMenu() {
  const { coins, email, signOut } = useMaster();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = email?.split("@")[0] || "Guest";
  const initials = label.slice(0, 2).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${t.nav.profile}: ${label}`}
        className="flex items-center gap-2 rounded-full border border-nabi-border bg-nabi-card py-1 pl-1 pr-2.5 transition hover:border-nabi-neon/35 hover:bg-nabi-elevated"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-nabi-elevated to-nabi-muted text-[11px] font-semibold text-nabi-bg">
          {mounted ? initials : "··"}
        </span>
        <span className="hidden text-sm font-medium text-nabi-ink sm:inline">
          {label}
        </span>
        <ChevronDown
          size={14}
          className={`text-nabi-muted transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-nabi-border bg-nabi-surface shadow-2xl shadow-black/50"
        >
          <div className="border-b border-nabi-border px-3 py-3">
            <p className="truncate text-sm font-medium text-nabi-ink">{label}</p>
            <p className="mt-0.5 truncate text-[11px] text-nabi-muted">
              {email || "dev@alnabiy.local"}
            </p>
            <p className="mt-2 text-xs font-semibold tabular-nums text-amber-200/90">
              {mounted ? formatCredits(coins) : "… NC"}
            </p>
          </div>
          <div className="p-1.5">
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-nabi-ink transition hover:bg-nabi-elevated hover:text-nabi-ink"
            >
              <User size={15} />
              {t.nav.profile}
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                await signOut();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-nabi-ink transition hover:bg-nabi-elevated hover:text-nabi-ink"
            >
              <LogOut size={15} />
              {t.common.signOut}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
