"use client";

import Link from "next/link";
import {
  formatInsufficientFundsMessage,
  suggestAffordableDurationSec,
  type CostOpts,
  type GenerationKind,
} from "@/lib/credits";

type Props = {
  kind: GenerationKind;
  cost: number;
  coins: number;
  durationSec: number;
  costOpts?: CostOpts;
  /** Duration chips available on this screen (for suggestions). */
  durationCandidates?: number[];
  /** Apply suggested shorter duration. */
  onSelectDuration?: (durationSec: number) => void;
  /** Optional: switch to cheaper quality (e.g. 720p). */
  onSelectQuality?: (quality: string) => void;
  currentQuality?: string | null;
  storeLabel: string;
  tryDurationLabel: (durationSec: number, cost: number) => string;
  tryQualityLabel?: string;
  tr: (key: string) => string;
};

function formatDurationLabel(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const mins = Math.round(sec / 60);
  return mins === 1 ? "1 min" : `${mins} min`;
}

/**
 * Pre-GO insufficient balance banner — visible before the user clicks generate.
 */
export function InsufficientBalanceHint({
  kind,
  cost,
  coins,
  durationSec,
  costOpts,
  durationCandidates,
  onSelectDuration,
  onSelectQuality,
  currentQuality,
  storeLabel,
  tryDurationLabel,
  tryQualityLabel,
  tr,
}: Props) {
  if (coins >= cost) return null;

  const suggestion = suggestAffordableDurationSec(
    kind,
    coins,
    costOpts,
    durationCandidates && durationCandidates.length > 0
      ? durationCandidates.filter((d) => d < durationSec)
      : kind === "text_to_movie"
        ? [30, 60, 180, 300, 600].filter((d) => d < durationSec)
        : [5, 8, 10, 15].filter((d) => d < durationSec)
  );

  const canDowngradeQuality =
    Boolean(onSelectQuality) &&
    currentQuality &&
    currentQuality !== "720p" &&
    coins < cost;

  return (
    <div
      role="status"
      className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
    >
      <p className="font-medium text-rose-200">
        {formatInsufficientFundsMessage(cost, coins)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestion && onSelectDuration ? (
          <button
            type="button"
            onClick={() => onSelectDuration(suggestion.durationSec)}
            className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/20"
          >
            {tryDurationLabel(
              suggestion.durationSec,
              suggestion.cost
            )}
          </button>
        ) : null}
        {canDowngradeQuality ? (
          <button
            type="button"
            onClick={() => onSelectQuality?.("720p")}
            className="nabi-select px-3 py-1.5 text-xs"
          >
            {tryQualityLabel || tr("try_quality_720p")}
          </button>
        ) : null}
        <Link
          href="/pricing"
          className="rounded-lg border border-rose-400/50 bg-rose-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
        >
          {storeLabel}
        </Link>
      </div>
      {suggestion ? (
        <p className="mt-2 text-xs text-rose-200/70">
          {formatDurationLabel(suggestion.durationSec)} → {suggestion.cost} NC
        </p>
      ) : null}
    </div>
  );
}
