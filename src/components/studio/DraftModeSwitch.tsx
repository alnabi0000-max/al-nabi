"use client";

import clsx from "clsx";
import { DRAFT_PREVIEW_SEC } from "@/lib/studio/pro-controls";

type Props = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  title: string;
  hint: string;
};

export function DraftModeSwitch({ enabled, onChange, title, hint }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={clsx(
        "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition",
        enabled
          ? "border-amber-300/60 bg-amber-300/10"
          : "border-white/10 bg-white/[0.02] hover:border-white/25"
      )}
    >
      <span>
        <span className="block text-xs font-semibold uppercase tracking-wider text-white/80">
          {title}
        </span>
        <span className="mt-1 block text-[11px] text-white/40">{hint}</span>
      </span>
      <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[11px] text-white/70">
        {DRAFT_PREVIEW_SEC}s
      </span>
    </button>
  );
}
