"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Sparkles, Trash2 } from "lucide-react";
import clsx from "clsx";
import { SecurePlayer } from "@/components/SecurePlayer";
import { SecureStill } from "@/components/SecureStill";
import { RenderProgress } from "@/components/RenderProgress";
import { CINEMA_GLASS } from "@/components/studio/studio-primitives";
import type { RenderStage } from "@/lib/generation/progress";

type Props = {
  loading: boolean;
  imageUrl?: string | null;
  videoUrl?: string | null;
  progressPercent: number;
  renderStage: RenderStage;
  emptyLabel: string;
  aspect: "16:9" | "9:16" | "1:1";
  actions?: ReactNode;
  onUpscale?: () => void;
  onDelete?: () => void;
  upscaleDisabled?: boolean;
  labels: {
    upscale: string;
    delete: string;
  };
  seekRequest?: { token: number; time: number } | null;
  onTimeChange?: (current: number, duration: number) => void;
  controlledPlaying?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  creditBreakdown?: string | null;
};

const ASPECT_CLASS = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16] max-h-[78vh] mx-auto",
  "1:1": "aspect-square max-h-[78vh] mx-auto",
} as const;

export function StudioPreviewCanvas({
  loading,
  imageUrl,
  videoUrl,
  progressPercent,
  renderStage,
  emptyLabel,
  aspect,
  actions,
  onUpscale,
  onDelete,
  upscaleDisabled,
  labels,
  seekRequest,
  onTimeChange,
  controlledPlaying,
  onPlayingChange,
  creditBreakdown,
}: Props) {
  const hasOutput = Boolean(imageUrl || videoUrl);

  return (
    <div
      id="media-viewer"
      className={clsx(
        CINEMA_GLASS,
        "group relative scroll-mt-24 overflow-hidden p-1.5 md:p-2"
      )}
    >
      <div
        className={clsx(
          "relative overflow-hidden rounded-xl bg-black",
          ASPECT_CLASS[aspect]
        )}
      >
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[#09090B]">
            <motion.div
              className="h-20 w-20 rounded-full bg-gradient-to-br from-nabi-gold/35 via-nabi-neon/20 to-nabi-gold/15"
              animate={{ scale: [1, 1.12, 1], opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="w-full max-w-sm px-6">
              <RenderProgress percent={progressPercent} stage={renderStage} />
            </div>
          </div>
        ) : imageUrl ? (
          <SecureStill
            src={imageUrl}
            alt="Generated result"
            className="h-full rounded-none border-0 [&>img]:h-full [&>img]:object-cover"
          />
        ) : videoUrl ? (
          <SecurePlayer
            src={videoUrl}
            autoPlay
            muted
            className="!aspect-auto h-full rounded-none"
            seekRequest={seekRequest}
            onTimeChange={onTimeChange}
            controlledPlaying={controlledPlaying}
            onPlayingChange={onPlayingChange}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-nabi-gold/70">
              Al-Nabi
            </span>
            <p className="max-w-sm text-sm leading-relaxed text-white/45">{emptyLabel}</p>
            <span className="h-px w-12 bg-white/15" />
          </div>
        )}

        {hasOutput && !loading && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-end p-3 opacity-0 transition group-hover:opacity-100">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/15 bg-black/55 p-1 backdrop-blur-md">
              {actions}
              <IconBtn
                label={labels.upscale}
                onClick={onUpscale}
                disabled={upscaleDisabled}
                icon={<Sparkles size={14} />}
              />
              <IconBtn
                label={labels.delete}
                onClick={onDelete}
                icon={<Trash2 size={14} />}
              />
            </div>
          </div>
        )}
      </div>
      {creditBreakdown ? (
        <p className="mt-2 px-1 font-mono text-[10px] tabular-nums text-white/45">
          {creditBreakdown}
        </p>
      ) : null}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  icon,
  disabled,
}: {
  label: string;
  onClick?: () => void;
  icon: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white disabled:opacity-30"
    >
      {icon}
    </button>
  );
}
