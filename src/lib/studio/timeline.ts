/**
 * Studio multi-track timeline — client-safe types, waveform, frame math.
 * BGM is included in the video NC cost; TTS / SFX add clip charges.
 */

import {
  AUDIO_CREDIT_RATES,
  calculateActiveAudioCost,
  calculateSfxClipCost,
  calculateTtsClipCost,
  estimateSpeechDurationSec,
  type AudioClipKind,
  type AudioCostClip,
} from "@/lib/credits";
import type { BgmMode } from "@/lib/bgm/types";

export const TIMELINE_FPS = 24;
export const TIMELINE_MIN_SEC = 2;
export const TIMELINE_MAX_SEC = 15;
export const WAVEFORM_BARS = 72;
export const PIXELS_PER_SECOND = 56;

export type TimelineTrackKind = "video" | AudioClipKind;

export type TimelineClip = {
  id: string;
  kind: TimelineTrackKind;
  label: string;
  startSec: number;
  durationSec: number;
  muted: boolean;
  volume: number;
  color: string;
  /** Narration (voice) or Foley prompt (sfx) */
  prompt: string;
  audioUrl: string | null;
  waveform: number[];
  generating?: boolean;
};

export type TimelineState = {
  fps: number;
  durationSec: number;
  playheadSec: number;
  clips: TimelineClip[];
};

export const TRACK_COLORS: Record<TimelineTrackKind, string> = {
  video: "#22d3ee",
  voice: "#e879f9",
  sfx: "#fbbf24",
  bgm: "#34d399",
};

export function clampTimelineDuration(sec: number): number {
  if (!Number.isFinite(sec)) return TIMELINE_MIN_SEC;
  return Math.min(TIMELINE_MAX_SEC, Math.max(TIMELINE_MIN_SEC, sec));
}

export function secondsToFrames(sec: number, fps = TIMELINE_FPS): number {
  return Math.max(1, Math.round(sec * fps));
}

export function framesToSeconds(frames: number, fps = TIMELINE_FPS): number {
  return clampTimelineDuration(frames / Math.max(1, fps));
}

export function formatTimecode(sec: number, fps = TIMELINE_FPS): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const f = Math.floor((safe % 1) * fps);
  return `${m}:${s.toString().padStart(2, "0")}:${f.toString().padStart(2, "0")}`;
}

/** Deterministic placeholder peaks so empty clips still look like a timeline. */
export function seedWaveform(seed: string, bars = WAVEFORM_BARS): number[] {
  const peaks: number[] = [];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = 0; i < bars; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const n = ((h >>> 0) % 1000) / 1000;
    const envelope = 0.35 + 0.65 * Math.sin((i / bars) * Math.PI);
    peaks.push(Math.max(0.08, Math.min(1, n * envelope)));
  }
  return peaks;
}

export function clipHasAudioContent(clip: TimelineClip, bgmMode: BgmMode): boolean {
  if (clip.kind === "video") return false;
  if (clip.kind === "bgm") return bgmMode !== "off" && !clip.muted;
  if (clip.muted) return false;
  return Boolean(clip.prompt.trim() || clip.audioUrl);
}

export function clipToCostInput(
  clip: TimelineClip,
  bgmMode: BgmMode
): AudioCostClip | null {
  if (clip.kind === "video") return null;
  const durationSec =
    clip.kind === "voice"
      ? clip.audioUrl
        ? clip.durationSec
        : estimateSpeechDurationSec(clip.prompt)
      : clip.durationSec;
  return {
    kind: clip.kind,
    muted: clip.muted,
    hasContent: clipHasAudioContent(clip, bgmMode),
    durationSec,
  };
}

export function calculateTimelineAudioCost(
  clips: TimelineClip[],
  bgmMode: BgmMode
): number {
  const inputs = clips
    .map((c) => clipToCostInput(c, bgmMode))
    .filter((c): c is AudioCostClip => Boolean(c));
  return calculateActiveAudioCost(inputs);
}

export function costForClip(clip: TimelineClip, bgmMode: BgmMode): number {
  const input = clipToCostInput(clip, bgmMode);
  if (!input) return 0;
  return calculateActiveAudioCost([input]);
}

export function defaultTimelineClips(durationSec: number): TimelineClip[] {
  const dur = clampTimelineDuration(durationSec);
  return [
    {
      id: "video",
      kind: "video",
      label: "Video",
      startSec: 0,
      durationSec: dur,
      muted: false,
      volume: 1,
      color: TRACK_COLORS.video,
      prompt: "",
      audioUrl: null,
      waveform: seedWaveform("video"),
    },
    {
      id: "voice",
      kind: "voice",
      label: "Voice",
      startSec: 0,
      durationSec: dur,
      muted: false,
      volume: 1,
      color: TRACK_COLORS.voice,
      prompt: "",
      audioUrl: null,
      waveform: seedWaveform("voice"),
    },
    {
      id: "sfx",
      kind: "sfx",
      label: "SFX",
      startSec: 0,
      durationSec: Math.min(2, dur),
      muted: false,
      volume: 0.85,
      color: TRACK_COLORS.sfx,
      prompt: "",
      audioUrl: null,
      waveform: seedWaveform("sfx"),
    },
    {
      id: "bgm",
      kind: "bgm",
      label: "Music",
      startSec: 0,
      durationSec: dur,
      muted: false,
      volume: 0.28,
      color: TRACK_COLORS.bgm,
      prompt: "",
      audioUrl: null,
      waveform: seedWaveform("bgm"),
    },
  ];
}

export function syncClipsToDuration(
  clips: TimelineClip[],
  durationSec: number
): TimelineClip[] {
  const dur = clampTimelineDuration(durationSec);
  return clips.map((clip) => {
    if (clip.kind === "sfx") {
      const next = Math.min(clip.durationSec, dur);
      return { ...clip, durationSec: next, startSec: Math.min(clip.startSec, Math.max(0, dur - next)) };
    }
    return { ...clip, durationSec: dur, startSec: 0 };
  });
}

export {
  AUDIO_CREDIT_RATES,
  calculateSfxClipCost,
  calculateTtsClipCost,
  estimateSpeechDurationSec,
};
