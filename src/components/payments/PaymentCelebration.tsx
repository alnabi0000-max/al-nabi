"use client";

import { useEffect } from "react";
import { useTopUpUi } from "@/context/TopUpUiContext";
import { useMaster } from "@/context/MasterControllerContext";

export function PaymentCelebration() {
  const { celebration, clearCelebration } = useTopUpUi();
  const { tr } = useMaster();

  useEffect(() => {
    if (!celebration) return;
    const t = window.setTimeout(() => clearCelebration(), 3200);
    return () => window.clearTimeout(t);
  }, [celebration, clearCelebration]);

  if (!celebration) return null;

  return (
    <div className="glass-scrim pointer-events-none fixed inset-0 z-[95] flex items-center justify-center">
      <div className="chest-3d relative text-center">
        <div className="chest-lid text-7xl" aria-hidden>
          🎁
        </div>
        <p className="mt-4 text-lg font-bold text-nabi-gold">
          +{celebration.totalNc.toLocaleString()} {tr("coins")}
        </p>
        <p className="bonus-fly mt-2 text-sm font-semibold text-emerald-400">
          {celebration.packName} · {tr("topup_success_title")} ✨
        </p>
      </div>
    </div>
  );
}
