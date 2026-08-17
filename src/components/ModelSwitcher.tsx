"use client";

import clsx from "clsx";
import {
  IMAGE_MODEL_CARDS,
  VIDEO_MODEL_CARDS,
  RENDER_QUALITIES,
  FRAME_RATES,
  type FrameRate,
  type ImageEngineId,
  type RenderQuality,
  type VideoEngineId,
} from "@/lib/ai/catalog";
import type { CameraMovement } from "@/lib/types";
import { useMaster } from "@/context/MasterControllerContext";

const CAMERAS: { id: CameraMovement; labelKey: string }[] = [
  { id: "static", labelKey: "camera_static" },
  { id: "zoom_in", labelKey: "camera_zoom" },
  { id: "pan_left", labelKey: "camera_pan" },
  { id: "tilt_up", labelKey: "camera_tilt" },
  { id: "slow_mo", labelKey: "camera_slow_mo" },
  { id: "orbit", labelKey: "camera_orbit" },
];

type Props = {
  media: "video" | "image";
  videoEngine: VideoEngineId;
  imageEngine: ImageEngineId;
  quality: RenderQuality;
  frameRate: FrameRate;
  camera?: CameraMovement;
  onVideoEngine: (id: VideoEngineId) => void;
  onImageEngine: (id: ImageEngineId) => void;
  onQuality: (q: RenderQuality) => void;
  onFrameRate: (fps: FrameRate) => void;
  onCamera?: (c: CameraMovement) => void;
  /** script-to-movie: show compact video-only */
  compact?: boolean;
};

/**
 * Al-Nabi model switcher — public labels only (no third-party names).
 */
export function ModelSwitcher({
  media,
  videoEngine,
  imageEngine,
  quality,
  frameRate,
  camera,
  onVideoEngine,
  onImageEngine,
  onQuality,
  onFrameRate,
  onCamera,
  compact,
}: Props) {
  const { tr } = useMaster();
  const cards =
    media === "image"
      ? IMAGE_MODEL_CARDS
      : VIDEO_MODEL_CARDS.filter((c) =>
          compact
            ? ["kling-v2.5", "kling-v3", "luma-ray2", "runway-gen3", "auto"].includes(
                c.id
              )
            : true
        );

  const selected = media === "image" ? imageEngine : videoEngine;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs uppercase tracking-wider text-nabi-muted">
          {tr("studio_models")}
        </p>
        <p className="mb-2 text-[11px] text-nabi-muted">
          {tr("model_engine_hint")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {cards.map((card) => {
            const active = selected === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  if (media === "image") {
                    onImageEngine(card.id as ImageEngineId);
                  } else {
                    onVideoEngine(card.id as VideoEngineId);
                  }
                }}
                className={clsx(
                  "nabi-select px-3 py-2.5 text-left",
                  active && "nabi-select-on"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-nabi-ink">
                    {card.label}
                  </span>
                  {card.coinMultiplier !== 1 && (
                    <span className="text-[10px] text-amber-300/90">
                      ×{card.coinMultiplier}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-nabi-muted">
                  {card.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-nabi-muted">
            {tr("quality")}
          </p>
          <div className="flex flex-wrap gap-2">
            {RENDER_QUALITIES.filter((q) =>
              media === "image" ? q !== "8K" : true
            ).map((q) => (
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

        {media === "video" && (
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

      {media === "video" && onCamera && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-nabi-muted">
            {tr("camera_motion")}
          </p>
          <div className="flex flex-wrap gap-2">
            {CAMERAS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onCamera(c.id)}
                className={clsx(
                  "nabi-btn-ghost !px-3 !text-xs",
                  camera === c.id && "nabi-select-on"
                )}
              >
                {tr(c.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
