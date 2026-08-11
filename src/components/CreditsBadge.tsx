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
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-bold text-zinc-200">
        <span className="inline-block h-2 w-2 rounded-full bg-purple-400/40" />
        <span className="text-zinc-400">… NC</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15 px-3 py-1.5 text-sm font-bold tabular-nums text-white">
      <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-r from-indigo-400 to-pink-400" />
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
