"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import clsx from "clsx";
import type { BgmMode, BgmTrackMeta } from "@/lib/bgm/types";

export type BgmPickerLabels = {
  title: string;
  ai: string;
  manual: string;
  off: string;
  aiHint?: string;
  empty?: string;
  loading?: string;
};

type Props = {
  mode: BgmMode;
  trackId: string | null;
  onModeChange: (mode: BgmMode) => void;
  onTrackChange: (trackId: string | null) => void;
  labels: BgmPickerLabels;
  className?: string;
  disabled?: boolean;
};

const MODES: BgmMode[] = ["ai", "manual", "off"];

export function BgmPicker({
  mode,
  trackId,
  onModeChange,
  onTrackChange,
  labels,
  className,
  disabled,
}: Props) {
  const listId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tracks, setTracks] = useState<BgmTrackMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch("/api/music/tracks")
      .then(async (res) => {
        if (!res.ok) throw new Error("Unable to load music catalog");
        const data = (await res.json()) as { tracks?: BgmTrackMeta[] };
        if (!cancelled) setTracks(Array.isArray(data.tracks) ? data.tracks : []);
      })
      .catch(() => {
        if (!cancelled) setTracks([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode === "manual") return;
    audioRef.current?.pause();
    setPlayingId(null);
  }, [mode]);

  useEffect(() => {
    if (!loaded || tracks.length > 0) return;
    if (mode !== "off") onModeChange("off");
    if (trackId) onTrackChange(null);
  }, [loaded, mode, onModeChange, onTrackChange, trackId, tracks.length]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  function modeLabel(m: BgmMode): string {
    if (m === "ai") return labels.ai;
    if (m === "manual") return labels.manual;
    return labels.off;
  }

  function togglePlay(track: BgmTrackMeta) {
    const el = audioRef.current;
    if (!el) return;
    if (playingId === track.id && !el.paused) {
      el.pause();
      setPlayingId(null);
      return;
    }
    el.src = track.url;
    void el.play().then(
      () => setPlayingId(track.id),
      () => setPlayingId(null)
    );
  }

  // Do not advertise background music until licensed tracks are deployed.
  if (!loaded || tracks.length === 0) return null;

  return (
    <div className={clsx("space-y-2", className)}>
      <p className="text-xs font-medium uppercase tracking-wider text-nabi-muted">
        {labels.title}
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={labels.title}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            disabled={disabled}
            onClick={() => onModeChange(m)}
            className={clsx(
              "rounded-lg border px-2.5 py-1.5 text-xs transition",
              mode === m
                ? "border-nabi-neon/50 bg-nabi-elevated text-nabi-ink"
                : "border-nabi-border text-nabi-muted hover:border-nabi-neon/35",
              disabled && "opacity-50"
            )}
          >
            {modeLabel(m)}
          </button>
        ))}
      </div>

      {mode === "ai" && labels.aiHint && (
        <p className="text-[11px] leading-relaxed text-nabi-muted">{labels.aiHint}</p>
      )}

      {mode === "manual" && (
        <div
          id={listId}
          className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-nabi-border bg-nabi-input p-2"
        >
          {loading && (
            <p className="flex items-center gap-2 px-1 py-2 text-xs text-nabi-muted">
              <Loader2 size={12} className="animate-spin" />
              {labels.loading || "…"}
            </p>
          )}
          {!loading &&
            tracks.map((track) => {
              const selected = trackId === track.id;
              const isPlaying = playingId === track.id;
              return (
                <div
                  key={track.id}
                  className={clsx(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                    selected ? "bg-nabi-elevated text-nabi-ink" : "text-nabi-ink"
                  )}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => togglePlay(track)}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-nabi-border hover:bg-nabi-elevated"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onTrackChange(track.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate font-medium">{track.title}</span>
                    <span className="block capitalize text-[10px] text-nabi-muted">
                      {track.mood}
                    </span>
                  </button>
                </div>
              );
            })}
        </div>
      )}

      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => setPlayingId(null)}
        className="hidden"
      />
    </div>
  );
}
