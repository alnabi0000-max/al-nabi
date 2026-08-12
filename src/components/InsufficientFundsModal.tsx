"use client";

import { useRef } from "react";
import { useMaster } from "@/context/MasterControllerContext";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import Link from "next/link";

export function InsufficientFundsModal() {
  const { showInsufficientModal, setShowInsufficientModal, tr } = useMaster();
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setShowInsufficientModal(false);

  useDialogFocus(panelRef, showInsufficientModal, close);

  if (!showInsufficientModal) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
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
        className="insufficient-neon relative w-full max-w-md rounded-2xl border-2 border-rose-500/70 bg-[#12080c] p-6 shadow-[0_0_40px_rgba(244,63,94,0.55)] outline-none"
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
          <Link
            href="/profile?tab=dokon"
            onClick={close}
            className="nabi-btn-primary !bg-gradient-to-r !from-rose-600 !to-orange-600"
          >
            {tr("store")}
          </Link>
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
