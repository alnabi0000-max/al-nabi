"use client";

import { useEffect, useRef, useState } from "react";
import { useMaster } from "@/context/MasterControllerContext";
import { useTopUpUi } from "@/context/TopUpUiContext";
import { formatCredits } from "@/lib/credits";
import clsx from "clsx";

/**
 * Hydration-safe NC balance badge — opens the top-up modal.
 */
export function CreditsBadge() {
  const { coins } = useMaster();
  const { openTopUp } = useTopUpUi();
  const [isMounted, setIsMounted] = useState(false);
  const [pulse, setPulse] = useState(false);
  const prevCoins = useRef<number | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    if (prevCoins.current != null && coins > prevCoins.current) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 1400);
      prevCoins.current = coins;
      return () => window.clearTimeout(t);
    }
    prevCoins.current = coins;
  }, [coins, isMounted]);

  return (
    <button
      type="button"
      onClick={() => openTopUp()}
      className={clsx(
        "glass-card flex items-center gap-2 rounded-full px-3 py-1.5 text-sm tabular-nums text-nabi-ink",
        pulse
          ? "border-emerald-400/70 shadow-[0_0_18px_rgba(52,211,153,0.45)]"
          : "border-nabi-border hover:border-nabi-gold/40"
      )}
      aria-label="NC"
    >
      <span
        className={clsx(
          "inline-block h-1.5 w-1.5 rounded-full",
          pulse ? "bg-emerald-400" : "bg-nabi-ink/70"
        )}
      />
      {isMounted ? formatCredits(coins) : "… NC"}
    </button>
  );
}
