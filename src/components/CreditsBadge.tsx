"use client";

import { useEffect, useState } from "react";
import { useMaster } from "@/context/MasterControllerContext";
import { formatCredits, LS_COINS } from "@/lib/credits";

/**
 * Hydration-safe NC balance badge.
 */
export function CreditsBadge() {
  const { coins } = useMaster();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-nabi-border bg-nabi-card px-3 py-1.5 text-sm font-bold text-nabi-ink">
        <span className="inline-block h-2 w-2 rounded-full bg-nabi-neon/40" />
        <span className="text-nabi-muted">… NC</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-nabi-border bg-gradient-to-r from-[var(--accent-from)]/15 via-[var(--accent-via)]/15 to-[var(--accent-to)]/15 px-3 py-1.5 text-sm font-bold tabular-nums text-nabi-ink">
      <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)]" />
      {formatCredits(coins)}
    </div>
  );
}

/** Legacy helper — MasterController orqali deduct */
export function deductCreditsLocal(amount: number): number {
  try {
    const cur = parseInt(localStorage.getItem(LS_COINS) || "20000", 10);
    const next = Math.max(0, cur - amount);
    localStorage.setItem(LS_COINS, String(next));
    return next;
  } catch {
    return 0;
  }
}
