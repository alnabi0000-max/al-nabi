"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useMaster } from "@/context/MasterControllerContext";
import {
  VIDEO_SHOWCASE_AUTOPLAY_MS,
  VIDEO_SHOWCASE_EXAMPLES,
} from "@/lib/video-showcase";

type Props = {
  className?: string;
  /** Short strip above the form on small screens. */
  compact?: boolean;
};

/**
 * Full-bleed muted reel so guests see what Al-Nabi can generate
 * instead of reading marketing copy.
 */
export function AuthHeroVideo({ className, compact }: Props) {
  const { tr } = useMaster();
  const clips = VIDEO_SHOWCASE_EXAMPLES.filter((ex) => ex.afterVideo);
  const [index, setIndex] = useState(0);
  const active = clips[index] ?? clips[0];

  useEffect(() => {
    if (clips.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % clips.length);
    }, VIDEO_SHOWCASE_AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [clips.length]);

  if (!active?.afterVideo) return null;

  return (
    <div
      className={
        className ??
        (compact ? "relative h-44 overflow-hidden sm:h-52" : "absolute inset-0")
      }
    >
      <video
        key={active.afterVideo}
        src={active.afterVideo}
        poster={active.afterPoster || active.beforeImage}
        className="h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/35"
      />
      {!compact ? (
        <div className="absolute left-8 top-8 z-10 flex items-center gap-2 text-xs font-medium tracking-wide text-white/90">
          <Sparkles size={14} className="text-nabi-gold" />
          {tr("auth_split_badge")}
        </div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-5 sm:px-8 sm:pb-8">
        <p className="max-w-lg text-sm font-medium leading-snug text-white sm:text-base">
          “{active.prompt}”
        </p>
        <p className="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-white/55">
          {active.title}
        </p>
        {clips.length > 1 ? (
          <div className="mt-3 flex gap-1.5" role="tablist" aria-label={tr("video_showcase_title")}>
            {clips.map((ex, i) => (
              <button
                key={ex.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={ex.title}
                onClick={() => setIndex(i)}
                className={
                  i === index
                    ? "h-1 w-6 rounded-full bg-nabi-gold"
                    : "h-1 w-2.5 rounded-full bg-white/35 transition hover:bg-white/60"
                }
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
