"use client";

import { useRef } from "react";
import { useMaster } from "@/context/MasterControllerContext";
import { useTopUpUi } from "@/context/TopUpUiContext";
import { useDialogFocus } from "@/hooks/useDialogFocus";

export function InsufficientFundsModal() {
  const { showInsufficientModal, setShowInsufficientModal, tr } = useMaster();
  const { openTopUp } = useTopUpUi();
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setShowInsufficientModal(false);

  useDialogFocus(panelRef, showInsufficientModal, close);

  if (!showInsufficientModal) return null;

  return (
    <div
      className="glass-scrim fixed inset-0 z-[90] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="insufficient-funds-title"
        tabIndex={-1}
        className="glass-modal insufficient-neon relative w-full max-w-md border-rose-500/50 p-6 shadow-[0_0_40px_rgba(244,63,94,0.28)] outline-none"
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-rose-500/10 to-transparent" />
        <p className="relative text-center text-xs uppercase tracking-[0.25em] text-rose-400">
          {tr("credit_gate")}
        </p>
        <h2
          id="insufficient-funds-title"
          className="relative mt-3 text-center text-2xl font-bold text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]"
        >
          {tr("insufficient_funds_title")}
        </h2>
        <p className="relative mt-3 text-center text-sm text-rose-200/80">
          {tr("insufficient_funds")}
        </p>
        <div className="relative mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              close();
              openTopUp();
            }}
            className="nabi-btn-primary !bg-gradient-to-r !from-rose-600 !to-orange-600"
          >
            {tr("store")}
          </button>
          <button
            type="button"
            onClick={close}
            className="nabi-btn-ghost !border-rose-500/40 !text-rose-200"
          >
            {tr("ok")}
          </button>
        </div>
      </div>
    </div>
  );
}
