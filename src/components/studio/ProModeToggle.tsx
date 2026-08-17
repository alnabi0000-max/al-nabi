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
        "nabi-select w-full justify-between px-3 py-2 text-xs uppercase tracking-wider",
        enabled
          ? "nabi-select-on"
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
          enabled ? "bg-nabi-gold" : "bg-white/15"
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
