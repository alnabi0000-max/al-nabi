"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { useAuthUi } from "@/context/AuthUiContext";
import { useMaster } from "@/context/MasterControllerContext";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { AuthPanel } from "@/components/auth/AuthPanel";

/**
 * Overlay auth — used when a signed-in surface (profile reset, expired
 * top-up) still needs a dialog. Guests get SplitAuthPage instead.
 */
export function AuthModal() {
  const { open, closeAuth, initialTab } = useAuthUi();
  const { tr } = useMaster();
  const panelRef = useRef<HTMLDivElement>(null);

  useDialogFocus(panelRef, open, closeAuth);

  if (!open) return null;

  return (
    <div
      className="glass-scrim fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuth();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={tr("auth_modal_title")}
        tabIndex={-1}
        className="glass-modal relative w-full max-w-md overflow-hidden p-6 outline-none"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-cinema-glow opacity-40 blur-3xl"
        />
        <button
          type="button"
          onClick={closeAuth}
          className="absolute right-4 top-4 z-10 rounded-xl p-2 text-nabi-muted transition hover:bg-white/5 hover:text-nabi-ink"
          aria-label={tr("close")}
        >
          <X size={18} />
        </button>
        <div className="relative pt-2">
          <AuthPanel
            variant="modal"
            initialTab={initialTab}
            onAuthenticated={closeAuth}
          />
        </div>
      </div>
    </div>
  );
}
