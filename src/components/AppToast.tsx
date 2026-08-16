"use client";

import { useEffect } from "react";
import { useMaster } from "@/context/MasterControllerContext";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import clsx from "clsx";
import { useIsMounted } from "@/hooks/useIsMounted";

/**
 * Global Toast / Alert — API va UX xabarlari
 */
export function AppToast() {
  const { appToast, clearAppToast, tr } = useMaster();
  const mounted = useIsMounted();

  useEffect(() => {
    if (!appToast) return;
    const t = window.setTimeout(() => clearAppToast(), appToast.durationMs ?? 4200);
    return () => window.clearTimeout(t);
  }, [appToast, clearAppToast]);

  if (!mounted || !appToast) return null;

  const Icon =
    appToast.type === "success"
      ? CheckCircle2
      : appToast.type === "info"
        ? Info
        : AlertCircle;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[9000] flex justify-center px-4 md:bottom-8"
    >
      <div
        className={clsx(
          "glass-modal pointer-events-auto flex max-w-md items-start gap-3 px-4 py-3 transition-opacity duration-200",
          appToast.type === "success" &&
            "border-emerald-500/40 text-emerald-400",
          appToast.type === "info" &&
            "border-nabi-neon/40 text-nabi-neon",
          appToast.type === "error" &&
            "border-rose-500/50 text-rose-400"
        )}
      >
        <Icon size={18} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          {appToast.title && (
            <p className="text-xs font-bold uppercase tracking-wide opacity-80">
              {appToast.title}
            </p>
          )}
          <p className="text-sm leading-snug">{appToast.message}</p>
        </div>
        <button
          type="button"
          onClick={clearAppToast}
          className="shrink-0 rounded-lg p-1 opacity-60 hover:opacity-100"
          aria-label={tr("close")}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
