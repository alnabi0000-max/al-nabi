"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Loader2, Minus, Pause, Play, Plus } from "lucide-react";
import clsx from "clsx";
import { CINEMA_GLASS } from "@/components/studio/studio-primitives";
import { TrackLane } from "@/components/studio/timeline/TrackLane";
import { BgmPicker } from "@/components/BgmPicker";
import type { BgmMode, BgmMood, BgmTrackMeta } from "@/lib/bgm/types";
import type { EmotionMode } from "@/lib/credits";
import {
  PIXELS_PER_SECOND,
  TIMELINE_FPS,
  TIMELINE_MAX_SEC,
  TIMELINE_MIN_SEC,
  calculateTimelineAudioCost,
  clampTimelineDuration,
  defaultTimelineClips,
  formatTimecode,
  framesToSeconds,
  secondsToFrames,
  seedWaveform,
  syncClipsToDuration,
  type TimelineClip,
} from "@/lib/studio/timeline";

export type TimelineCopy = {
  title: string;
  hint: string;
  frames: string;
  mute: string;
  unmute: string;
  included: string;
  voicePlaceholder: string;
  sfxPlaceholder: string;
  generateVoice: string;
  generateSfx: string;
  audioNc: string;
  bgmTitle: string;
  bgmAi: string;
  bgmManual: string;
  bgmOff: string;
  bgmAiHint: string;
  bgmEmpty: string;
  bgmLoading: string;
};

type Props = {
  durationSec: number;
  onDurationChange: (sec: number) => void;
  playheadSec: number;
  onSeek: (sec: number) => void;
  /** User-driven scrub — parent should also seek the video canvas. */
  onScrub?: (sec: number) => void;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  bgmMode: BgmMode;
  bgmTrackId: string | null;
  onBgmModeChange: (mode: BgmMode) => void;
  onBgmTrackChange: (trackId: string | null) => void;
  emotionMode: EmotionMode;
  disabled?: boolean;
  copy: TimelineCopy;
  onGenerateVoice: (clip: TimelineClip) => Promise<TimelineClip | null>;
  onGenerateSfx: (clip: TimelineClip) => Promise<TimelineClip | null>;
  onAudioCostChange?: (nc: number) => void;
  /** When true, an external video clock owns playhead (no local RAF). */
  externalClock?: boolean;
};

export function StudioTimeline({
  durationSec,
  onDurationChange,
  playheadSec,
  onSeek,
  onScrub,
  playing,
  onPlayingChange,
  bgmMode,
  bgmTrackId,
  onBgmModeChange,
  onBgmTrackChange,
  emotionMode,
  disabled,
  copy,
  onGenerateVoice,
  onGenerateSfx,
  onAudioCostChange,
  externalClock = false,
}: Props) {
  const [clips, setClips] = useState<TimelineClip[]>(() =>
    defaultTimelineClips(durationSec)
  );
  const [voiceDraft, setVoiceDraft] = useState("");
  const [sfxDraft, setSfxDraft] = useState("");
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const rafRef = useRef<number>(0);
  const lastTick = useRef<number>(0);
  const playheadRef = useRef(playheadSec);

  const duration = clampTimelineDuration(durationSec);
  const frames = secondsToFrames(duration);
  const audioNc = useMemo(
    () => calculateTimelineAudioCost(clips, bgmMode),
    [clips, bgmMode]
  );

  useEffect(() => {
    playheadRef.current = playheadSec;
  }, [playheadSec]);

  useEffect(() => {
    setClips((prev) => syncClipsToDuration(prev, duration));
  }, [duration]);

  useEffect(() => {
    onAudioCostChange?.(audioNc);
  }, [audioNc, onAudioCostChange]);

  useEffect(() => {
    setClips((prev) =>
      prev.map((c) =>
        c.kind === "bgm" ? { ...c, muted: bgmMode === "off" } : c
      )
    );
  }, [bgmMode]);

  useEffect(() => {
    if (bgmMode === "off") {
      setClips((prev) =>
        prev.map((c) => (c.kind === "bgm" ? { ...c, audioUrl: null } : c))
      );
      return;
    }
    let cancelled = false;
    void fetch("/api/music/tracks")
      .then(async (res) => {
        const data = (await res.json()) as { tracks?: BgmTrackMeta[] };
        const tracks = Array.isArray(data.tracks) ? data.tracks : [];
        if (cancelled || tracks.length === 0) return;
        const mood = emotionToMood(emotionMode);
        const picked =
          (bgmTrackId && tracks.find((t) => t.id === bgmTrackId)) ||
          tracks.find((t) => t.mood === mood) ||
          tracks[0];
        if (!picked) return;
        setClips((prev) =>
          prev.map((c) =>
            c.kind === "bgm"
              ? {
                  ...c,
                  audioUrl: picked.url,
                  waveform: seedWaveform(picked.id),
                  muted: false,
                }
              : c
          )
        );
      })
      .catch(() => {
        /* catalog optional */
      });
    return () => {
      cancelled = true;
    };
    // updateClip is local and would retrigger the fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgmMode, bgmTrackId, emotionMode]);

  const syncAudio = useCallback(
    (sec: number, shouldPlay: boolean) => {
      for (const clip of clips) {
        const el = audioRefs.current[clip.id];
        if (!el || !clip.audioUrl || clip.muted || clip.kind === "video") {
          el?.pause();
          continue;
        }
        const local = sec - clip.startSec;
        if (local < 0 || local > clip.durationSec) {
          el.pause();
          continue;
        }
        if (Math.abs(el.currentTime - local) > 0.12) {
          el.currentTime = Math.max(0, local);
        }
        el.volume = Math.max(0, Math.min(1, clip.volume));
        if (shouldPlay && el.paused) {
          void el.play().catch(() => {});
        } else if (!shouldPlay && !el.paused) {
          el.pause();
        }
      }
    },
    [clips]
  );

  useEffect(() => {
    syncAudio(playheadSec, playing);
  }, [playheadSec, playing, syncAudio]);

  useEffect(() => {
    if (!playing || externalClock) {
      lastTick.current = 0;
      return;
    }
    lastTick.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTick.current) / 1000;
      lastTick.current = now;
      const next = playheadRef.current + dt;
      if (next >= duration) {
        onSeek(0);
        onPlayingChange(false);
        return;
      }
      onSeek(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, duration, onSeek, onPlayingChange, externalClock]);

  function updateClip(id: string, patch: Partial<TimelineClip>) {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function jumpTo(sec: number) {
    onSeek(sec);
    onScrub?.(sec);
  }

  function onRulerPointer(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    jumpTo(ratio * duration);
  }

  async function generateVoice() {
    const clip = clips.find((c) => c.kind === "voice");
    if (!clip || disabled) return;
    const next = { ...clip, prompt: voiceDraft.trim(), generating: true };
    updateClip(clip.id, { prompt: next.prompt, generating: true });
    const result = await onGenerateVoice(next);
    if (result) {
      updateClip(clip.id, {
        ...result,
        generating: false,
        waveform: result.waveform.length
          ? result.waveform
          : seedWaveform(result.audioUrl || "voice"),
      });
    } else {
      updateClip(clip.id, { generating: false });
    }
  }

  async function generateSfx() {
    const clip = clips.find((c) => c.kind === "sfx");
    if (!clip || disabled) return;
    const next = { ...clip, prompt: sfxDraft.trim(), generating: true };
    updateClip(clip.id, { prompt: next.prompt, generating: true });
    const result = await onGenerateSfx(next);
    if (result) {
      updateClip(clip.id, {
        ...result,
        generating: false,
        waveform: result.waveform.length
          ? result.waveform
          : seedWaveform(result.audioUrl || "sfx"),
      });
    } else {
      updateClip(clip.id, { generating: false });
    }
  }

  const rulerWidth = duration * PIXELS_PER_SECOND;
  const ticks = Array.from({ length: Math.floor(duration) + 1 }, (_, i) => i);
  const voiceBusy = clips.some((c) => c.kind === "voice" && c.generating);
  const sfxBusy = clips.some((c) => c.kind === "sfx" && c.generating);

  return (
    <div className={clsx(CINEMA_GLASS, "space-y-3 p-3 md:p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/75">
            {copy.title}
          </p>
          <p className="mt-0.5 max-w-md text-[11px] text-white/40">{copy.hint}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[10px] tabular-nums text-white/70">
            {copy.audioNc.replace("{cost}", String(audioNc))}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPlayingChange(!playing)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <span className="min-w-[4.8rem] font-mono text-[10px] tabular-nums text-white/60">
            {formatTimecode(playheadSec)} / {formatTimecode(duration)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-white/45">
          {copy.frames}
        </span>
        <button
          type="button"
          disabled={disabled || frames <= secondsToFrames(TIMELINE_MIN_SEC)}
          onClick={() => onDurationChange(framesToSeconds(frames - TIMELINE_FPS))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 text-white/70 hover:bg-white/10 disabled:opacity-30"
          aria-label="Shorter"
        >
          <Minus size={12} />
        </button>
        <span className="font-mono text-xs tabular-nums text-white">
          {frames}f · {duration.toFixed(1)}s
        </span>
        <button
          type="button"
          disabled={disabled || frames >= secondsToFrames(TIMELINE_MAX_SEC)}
          onClick={() => onDurationChange(framesToSeconds(frames + TIMELINE_FPS))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 text-white/70 hover:bg-white/10 disabled:opacity-30"
          aria-label="Longer"
        >
          <Plus size={12} />
        </button>
        <span className="text-[10px] text-white/35">{TIMELINE_FPS} fps</span>
        <span className="text-[10px] capitalize text-white/35">{emotionMode}</span>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: Math.max(rulerWidth + 96, 320) }}>
          <div
            className="relative ml-[6rem] mb-1 h-5 cursor-pointer"
            onPointerDown={onRulerPointer}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={playheadSec}
            tabIndex={0}
          >
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute top-0 font-mono text-[9px] text-white/35"
                style={{ left: t * PIXELS_PER_SECOND }}
              >
                {t}s
              </span>
            ))}
            <span
              className="pointer-events-none absolute top-0 z-10 h-full w-px bg-cyan-300"
              style={{ left: playheadSec * PIXELS_PER_SECOND }}
            />
          </div>
          <div className="relative space-y-1.5">
            {clips.map((clip) => (
              <TrackLane
                key={clip.id}
                clip={clip}
                timelineSec={duration}
                playheadSec={playheadSec}
                bgmMode={bgmMode}
                includedLabel={copy.included}
                muteLabel={copy.mute}
                unmuteLabel={copy.unmute}
                onMuteToggle={() => {
                  if (clip.kind === "bgm") {
                    onBgmModeChange(clip.muted ? "ai" : "off");
                  }
                  updateClip(clip.id, { muted: !clip.muted });
                }}
                onScrub={jumpTo}
              />
            ))}
            <span
              className="pointer-events-none absolute top-0 z-10 h-full w-px bg-cyan-300/90"
              style={{ left: `calc(5.5rem + 0.5rem + ${playheadSec * PIXELS_PER_SECOND}px)` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <textarea
            value={voiceDraft}
            onChange={(e) => {
              setVoiceDraft(e.target.value);
              updateClip("voice", { prompt: e.target.value });
            }}
            placeholder={copy.voicePlaceholder}
            disabled={disabled || voiceBusy}
            maxLength={500}
            rows={2}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-fuchsia-400/40 focus:outline-none"
          />
          <button
            type="button"
            disabled={disabled || voiceBusy || !voiceDraft.trim()}
            onClick={() => void generateVoice()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-400/40 px-3 py-1.5 text-[11px] text-white transition hover:bg-fuchsia-500/15 disabled:opacity-40"
          >
            {voiceBusy ? <Loader2 size={12} className="animate-spin" /> : null}
            {copy.generateVoice}
          </button>
        </div>
        <div className="space-y-2">
          <textarea
            value={sfxDraft}
            onChange={(e) => {
              setSfxDraft(e.target.value);
              updateClip("sfx", { prompt: e.target.value });
            }}
            placeholder={copy.sfxPlaceholder}
            disabled={disabled || sfxBusy}
            maxLength={240}
            rows={2}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-amber-400/40 focus:outline-none"
          />
          <button
            type="button"
            disabled={disabled || sfxBusy || !sfxDraft.trim()}
            onClick={() => void generateSfx()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 px-3 py-1.5 text-[11px] text-white transition hover:bg-amber-400/15 disabled:opacity-40"
          >
            {sfxBusy ? <Loader2 size={12} className="animate-spin" /> : null}
            {copy.generateSfx}
          </button>
        </div>
      </div>

      <BgmPicker
        mode={bgmMode}
        trackId={bgmTrackId}
        onModeChange={onBgmModeChange}
        onTrackChange={onBgmTrackChange}
        disabled={disabled}
        labels={{
          title: copy.bgmTitle,
          ai: copy.bgmAi,
          manual: copy.bgmManual,
          off: copy.bgmOff,
          aiHint: copy.bgmAiHint,
          empty: copy.bgmEmpty,
          loading: copy.bgmLoading,
        }}
      />

      {clips.map((clip) =>
        clip.audioUrl ? (
          <audio
            key={clip.id}
            ref={(el) => {
              audioRefs.current[clip.id] = el;
            }}
            src={clip.audioUrl}
            preload="metadata"
            className="hidden"
          />
        ) : null
      )}
    </div>
  );
}

function emotionToMood(emotion: EmotionMode): BgmMood {
  if (emotion === "calm" || emotion === "neutral") return "calm";
  if (emotion === "joy") return "upbeat";
  if (emotion === "drama") return "suspense";
  return "epic";
}
