"use client";

import { useMaster } from "@/context/MasterControllerContext";
import { SecurePlayer } from "@/components/SecurePlayer";
import { WATERMARK } from "@/lib/credits";
import clsx from "clsx";

interface Props {
  srcA?: string | null;
  srcB?: string | null;
  labelA?: string;
  labelB?: string;
  active?: "A" | "B";
  onSelect?: (which: "A" | "B") => void;
  autoPlay?: boolean;
}

/**
 * Dual Preview (A/B) + 60fps SecurePlayer watermark zanjiri
 */
export function DualPreview({
  srcA,
  srcB,
  labelA,
  labelB,
  active = "A",
  onSelect,
  autoPlay = true,
}: Props) {
  const { tr } = useMaster();
  const aLabel = labelA || tr("preview_a");
  const bLabel = labelB || tr("preview_b");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-nabi-muted">
          {tr("dual_preview_title")}
        </h2>
        <span className="text-[10px] text-emerald-400">{WATERMARK}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div
          role="button"
          tabIndex={0}
          aria-pressed={active === "A"}
          aria-label={aLabel}
          onClick={() => onSelect?.("A")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSelect?.("A");
          }}
          className={clsx(
            "cursor-pointer rounded-2xl border p-2 text-left transition-all duration-300 ease-apple",
            active === "A"
              ? "border-nabi-neon shadow-neon"
              : "border-nabi-border opacity-80 hover:opacity-100"
          )}
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-nabi-neon">
            {aLabel}
          </p>
          <SecurePlayer
            src={srcA}
            autoPlay={autoPlay && active === "A"}
          />
        </div>
        <div
          role="button"
          tabIndex={0}
          aria-pressed={active === "B"}
          aria-label={bLabel}
          onClick={() => onSelect?.("B")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSelect?.("B");
          }}
          className={clsx(
            "cursor-pointer rounded-2xl border p-2 text-left transition-all duration-300 ease-apple",
            active === "B"
              ? "border-nabi-gold shadow-gold"
              : "border-nabi-border opacity-80 hover:opacity-100"
          )}
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-nabi-gold">
            {bLabel}
          </p>
          <SecurePlayer
            src={srcB}
            autoPlay={autoPlay && active === "B"}
          />
        </div>
      </div>
      <p className="text-[10px] text-nabi-muted">{tr("dual_preview_hint")}</p>
    </div>
  );
}
