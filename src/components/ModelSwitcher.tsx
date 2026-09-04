"use client";

import clsx from "clsx";
import {
  PUBLIC_RENDER_QUALITIES,
  FRAME_RATES,
  type FrameRate,
  type RenderQuality,
} from "@/lib/ai/catalog";
import { useMaster } from "@/context/MasterControllerContext";

type Props = {
  quality: RenderQuality;
  frameRate: FrameRate;
  onQuality: (q: RenderQuality) => void;
  onFrameRate: (fps: FrameRate) => void;
  showFrameRate?: boolean;
};

/**
 * Render quality only — Al-Nabi chooses the underlying cinema engine.
 */
export function ModelSwitcher({
  quality,
  frameRate,
  onQuality,
  onFrameRate,
  showFrameRate = true,
}: Props) {
  const { tr } = useMaster();

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-nabi-muted">{tr("model_engine_hint")}</p>
      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-nabi-muted">
          {tr("quality")}
        </p>
        <div className="flex flex-wrap gap-2">
          {PUBLIC_RENDER_QUALITIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onQuality(q)}
              className={clsx(
                "nabi-btn-ghost !px-3",
                quality === q && "nabi-select-on"
              )}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {showFrameRate && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-nabi-muted">
            {tr("frame_rate")}
          </p>
          <div className="flex flex-wrap gap-2">
            {FRAME_RATES.map((fps) => (
              <button
                key={fps}
                type="button"
                onClick={() => onFrameRate(fps)}
                className={clsx(
                  "nabi-btn-ghost !px-3",
                  frameRate === fps && "nabi-select-on"
                )}
              >
                {fps} fps
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
