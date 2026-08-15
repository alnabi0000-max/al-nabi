"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { Volume2, VolumeX } from "lucide-react";
import clsx from "clsx";
import { AudioWaveform } from "@/components/studio/timeline/AudioWaveform";
import {
  PIXELS_PER_SECOND,
  costForClip,
  type TimelineClip,
} from "@/lib/studio/timeline";
import type { BgmMode } from "@/lib/bgm/types";

type Props = {
  clip: TimelineClip;
  timelineSec: number;
  playheadSec: number;
  bgmMode: BgmMode;
  includedLabel: string;
  muteLabel: string;
  unmuteLabel: string;
  onMuteToggle: () => void;
  onScrub: (sec: number) => void;
};

export function TrackLane({
  clip,
  timelineSec,
  playheadSec,
  bgmMode,
  includedLabel,
  muteLabel,
  unmuteLabel,
  onMuteToggle,
  onScrub,
}: Props) {
  const widthPx = Math.max(48, clip.durationSec * PIXELS_PER_SECOND);
  const leftPx = clip.startSec * PIXELS_PER_SECOND;
  const localProgress =
    clip.durationSec > 0
      ? Math.min(1, Math.max(0, (playheadSec - clip.startSec) / clip.durationSec))
      : 0;
  const nc = costForClip(clip, bgmMode);
  const costLabel =
    clip.kind === "bgm"
      ? includedLabel
      : clip.kind === "video"
        ? ""
        : nc > 0
          ? `${nc} NC`
          : "0 NC";

  function onPointer(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onScrub(ratio * timelineSec);
  }

  return (
    <div className="flex items-stretch gap-2">
      <div className="flex w-[5.5rem] shrink-0 flex-col justify-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
          {clip.label}
        </span>
        {costLabel ? (
          <span className="font-mono text-[10px] tabular-nums text-white/40">
            {costLabel}
          </span>
        ) : null}
        {clip.kind !== "video" && (
          <button
            type="button"
            onClick={onMuteToggle}
            aria-label={clip.muted ? unmuteLabel : muteLabel}
            aria-pressed={clip.muted}
            className={clsx(
              "inline-flex h-6 w-6 items-center justify-center rounded-md border transition",
              clip.muted
                ? "border-white/10 text-white/30"
                : "border-white/20 text-white/80 hover:bg-white/10"
            )}
          >
            {clip.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
          </button>
        )}
      </div>
      <div
        className="relative h-12 min-w-0 flex-1 overflow-hidden rounded-lg bg-black/50"
        onPointerDown={onPointer}
      >
        <div
          className="absolute top-1 bottom-1 overflow-hidden rounded-md border border-white/10"
          style={{
            left: leftPx,
            width: widthPx,
            background: `${clip.color}22`,
            borderColor: `${clip.color}55`,
          }}
        >
          <AudioWaveform
            peaks={clip.waveform}
            progress={localProgress}
            color={clip.color}
            muted={clip.muted}
          />
        </div>
      </div>
    </div>
  );
}
