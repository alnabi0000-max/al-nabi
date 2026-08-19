"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useMaster } from "@/context/MasterControllerContext";
import {
  VIDEO_SHOWCASE_AUTOPLAY_MS,
  VIDEO_SHOWCASE_EXAMPLES,
} from "@/lib/video-showcase";

/**
 * Full-viewport AI reel behind the glass sign-in panel.
 */
export function AuthHeroVideo() {
  const { tr } = useMaster();
  const clips = VIDEO_SHOWCASE_EXAMPLES.filter(
    (ex) => ex.beforeImage || ex.afterVideo
  );
  const [index, setIndex] = useState(0);
  const active = clips[index] ?? clips[0];
  const src = active?.afterVideo || active?.beforeImage || active?.afterPoster;

  useEffect(() => {
    if (clips.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % clips.length);
    }, VIDEO_SHOWCASE_AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [clips.length]);

  if (!src) return null;

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {active.afterVideo ? (
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
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className="nabi-kenburns h-full w-full object-cover"
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-black/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent"
      />

      <div className="absolute left-6 top-6 z-10 hidden items-center gap-2 text-xs font-medium tracking-wide text-white/90 lg:flex">
        <Sparkles size={14} className="text-nabi-gold" />
        {tr("auth_split_badge")}
      </div>

      <div className="absolute bottom-8 left-6 z-10 hidden max-w-lg lg:block">
        <p className="text-[11px] uppercase tracking-[0.22em] text-nabi-gold">
          {tr(active.titleKey)}
        </p>
        <p className="mt-2 text-lg font-medium leading-snug text-white drop-shadow">
          {tr(active.promptKey)}
        </p>
        {clips.length > 1 ? (
          <div
            className="mt-4 flex gap-1.5"
            role="tablist"
            aria-label={tr("video_showcase_title")}
          >
            {clips.map((ex, i) => (
              <button
                key={ex.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={tr(ex.titleKey)}
                onClick={() => setIndex(i)}
                className={
                  i === index
                    ? "h-1 w-7 rounded-full bg-nabi-gold"
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
