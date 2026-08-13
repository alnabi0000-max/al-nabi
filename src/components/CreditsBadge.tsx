"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMaster } from "@/context/MasterControllerContext";
import { formatCredits, LS_COINS } from "@/lib/credits";
import { profileHref } from "@/lib/profile-tabs";

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
      <Link
        href={profileHref("dokon")}
        className="flex items-center gap-2 rounded-full border border-nabi-border bg-nabi-card px-3 py-1.5 text-sm tabular-nums text-nabi-ink"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-nabi-neon/40" />
        <span className="text-nabi-muted">… NC</span>
      </Link>
    );
  }

  return (
    <Link
      href={profileHref("dokon")}
      className="flex items-center gap-2 rounded-full border border-nabi-border bg-nabi-card px-3 py-1.5 text-sm tabular-nums text-nabi-ink"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-nabi-ink/70" />
      {formatCredits(coins)}
    </Link>
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
