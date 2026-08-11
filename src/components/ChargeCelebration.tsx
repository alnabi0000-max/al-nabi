"use client";

import { useMaster } from "@/context/MasterControllerContext";

export function ChargeCelebration() {
  const { chargeReceipt, clearChargeReceipt, tr } = useMaster();

  if (!chargeReceipt) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[85] flex items-start justify-center bg-black/60 pt-10 backdrop-blur-sm">
      <div className="receipt-slide w-full max-w-sm px-4">
        <div className="mb-6 flex justify-center">
          <div className="chest-3d relative text-center">
            <div className="chest-lid text-7xl">🎁</div>
            <p className="mt-3 text-lg font-bold text-nabi-gold">
              −{chargeReceipt.cost.toLocaleString()} {tr("coins")}
            </p>
            {chargeReceipt.bonusGift > 0 && (
              <p className="bonus-fly mt-2 text-sm font-semibold text-emerald-400">
                +{chargeReceipt.bonusGift.toLocaleString()} {tr("bonus_gift")} ✨
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/40 bg-[#14110a]/95 p-4 font-mono text-xs text-amber-100 shadow-[0_0_28px_rgba(245,200,66,0.25)]">
          <div className="mb-2 flex items-center justify-between border-b border-amber-500/30 pb-2">
            <span className="font-bold text-nabi-gold">
              {tr("digital_receipt")}
            </span>
            <span className="text-[10px] text-amber-500/80">
              {chargeReceipt.receiptId}
            </span>
          </div>
          <p className="text-amber-200/90">{chargeReceipt.label}</p>
          <p className="mt-1 text-zinc-400">
            {new Date(chargeReceipt.at).toLocaleString()}
          </p>
          <p className="mt-3 text-emerald-400">
            {tr("balance")} → {chargeReceipt.balanceAfter.toLocaleString()}{" "}
            {tr("coins")}
          </p>
          <button
            type="button"
            className="pointer-events-auto mt-4 w-full rounded-lg border border-amber-500/30 py-2 text-amber-200 transition hover:bg-amber-500/10"
            onClick={() => clearChargeReceipt()}
          >
            {tr("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
