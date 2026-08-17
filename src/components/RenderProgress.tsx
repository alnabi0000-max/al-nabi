"use client";

import { Loader2 } from "lucide-react";
import clsx from "clsx";
import {
  stageLabelKey,
  type RenderStage,
} from "@/lib/generation/progress";
import { useMaster } from "@/context/MasterControllerContext";

type Props = {
  percent: number;
  stage?: RenderStage;
  label?: string;
  className?: string;
  compact?: boolean;
};

/**
 * Real-time render progress — Inngest/Generation status bilan sinxron.
 */
export function RenderProgress({
  percent,
  stage = "queued",
  label,
  className,
  compact,
}: Props) {
  const { tr } = useMaster();
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const failed = stage === "failed";
  const done = stage === "completed";
  const stageText = label || tr(stageLabelKey(stage));

  return (
    <div
      className={clsx("space-y-2", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={stageText}
    >
      {!compact && (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span
            className={clsx(
              "inline-flex items-center gap-1.5",
              failed
                ? "text-rose-400"
                : done
                  ? "text-emerald-400"
                  : "text-nabi-neon"
            )}
          >
            {!done && !failed && (
              <Loader2 size={12} className="animate-spin" />
            )}
            {stageText}
          </span>
          <span className="tabular-nums text-nabi-muted">{pct}%</span>
        </div>
      )}
      <div className="relative h-2 overflow-hidden rounded-full bg-nabi-elevated">
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-500 ease-out",
            failed
              ? "bg-rose-500"
              : done
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-nabi-gold via-nabi-neon to-nabi-gold"
          )}
          style={{ width: `${pct}%` }}
        />
        {!done && !failed && (
          <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        )}
      </div>
    </div>
  );
}
