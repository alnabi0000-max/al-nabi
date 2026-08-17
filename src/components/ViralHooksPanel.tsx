"use client";

import { useState } from "react";
import { Loader2, Sparkles, Zap } from "lucide-react";
import type { EmotionMode } from "@/lib/credits";
import { useMaster } from "@/context/MasterControllerContext";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";

interface ViralPack {
  frames: {
    index: number;
    label: string;
    mockUrl: string;
    timeSec: number;
    isReal?: boolean;
  }[];
  thumbnails: { title: string; neonClass: string }[];
  hooks: string[];
  note?: string;
}

interface Props {
  videoUrl?: string | null;
  scriptOrPrompt: string;
  emotionMode: EmotionMode;
  durationSec: number;
}

export function ViralHooksPanel({
  videoUrl,
  scriptOrPrompt,
  emotionMode,
  durationSec,
}: Props) {
  const { tr, locale, alnabiyKey } = useMaster();
  const [pack, setPack] = useState<ViralPack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!scriptOrPrompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(
        "/api/viral/hooks",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl,
            scriptOrPrompt,
            emotionMode,
            durationSec,
            locale,
            alnabiyKey,
          }),
        },
        45_000
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr("error_generic"));
      setPack(data.pack);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("error_generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="nabi-card space-y-4 border-nabi-gold/20 bg-gradient-to-b from-nabi-gold/5 to-transparent">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-nabi-gold">
            <Zap size={16} /> {tr("viral_title")}
          </h3>
          <p className="mt-1 text-xs text-nabi-muted">{tr("viral_subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading || !scriptOrPrompt.trim()}
          className="nabi-btn-ghost !border-nabi-gold/40 !text-nabi-gold !text-xs"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {tr("viral_generate")}
        </button>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {pack && (
        <div className="space-y-4">
          {pack.frames.some((f) => f.isReal) && (
            <div className="grid gap-3 sm:grid-cols-3">
              {pack.frames
                .filter((f) => f.isReal)
                .map((f) => (
              <div
                key={f.index}
                className="relative overflow-hidden rounded-xl border border-nabi-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.mockUrl}
                  alt={f.label}
                  className="aspect-video w-full object-cover"
                />
                {f.isReal === false && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-nabi-ink">
                    {tr("preview")}
                  </span>
                )}
                <p className="px-2 py-1.5 text-[10px] text-nabi-muted">
                  {tr("peak_frame")} #{f.index} · {f.timeSec}s
                </p>
              </div>
                ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-nabi-muted">
              {tr("viral_thumbnails")}
            </p>
            {pack.thumbnails.map((thumb) => (
              <div
                key={thumb.title}
                className={`rounded-xl bg-gradient-to-r ${thumb.neonClass} p-[1px]`}
              >
                <div className="rounded-[11px] bg-nabi-surface px-3 py-2 text-sm font-bold tracking-wide text-nabi-ink">
                  {thumb.title}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-nabi-muted">
              {tr("viral_hooks_label")}
            </p>
            {pack.hooks.map((h) => (
              <p
                key={h}
                className="rounded-lg border border-nabi-gold/30 bg-nabi-gold/5 px-3 py-2 text-xs text-nabi-gold"
              >
                {h}
              </p>
            ))}
          </div>

          {pack.note && (
            <p className="text-[10px] text-nabi-muted">{pack.note}</p>
          )}
        </div>
      )}
    </div>
  );
}
