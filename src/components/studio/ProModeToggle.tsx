"use client";

import { SlidersHorizontal } from "lucide-react";
import clsx from "clsx";

type Props = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
};

export function ProModeToggle({ enabled, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={clsx(
        "inline-flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition",
        enabled
          ? "border-fuchsia-400/60 bg-fuchsia-500/10 text-white shadow-[0_0_18px_rgba(232,121,249,0.2)]"
          : "border-white/10 text-white/55 hover:border-white/25 hover:text-white"
      )}
    >
      <span className="inline-flex items-center gap-2">
        <SlidersHorizontal size={14} />
        {label}
      </span>
      <span
        className={clsx(
          "relative h-5 w-9 rounded-full transition",
          enabled ? "bg-fuchsia-400" : "bg-white/15"
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-black transition-transform",
            enabled ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}
