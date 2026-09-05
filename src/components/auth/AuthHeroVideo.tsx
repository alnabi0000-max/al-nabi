"use client";

import Image from "next/image";
import { Sparkles } from "lucide-react";
import { useMaster } from "@/context/MasterControllerContext";
import { VIDEO_SHOWCASE_EXAMPLES } from "@/lib/video-showcase";

/**
 * Single still behind the glass sign-in panel.
 * A 6-image carousel here downloaded every guest visit and blocked first paint.
 */
export function AuthHeroVideo() {
  const { tr } = useMaster();
  const active = VIDEO_SHOWCASE_EXAMPLES[0];
  const src = active?.afterPoster || active?.beforeImage;
  if (!src) return null;

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <Image
        src={src}
        alt=""
        fill
        priority
        quality={68}
        sizes="100vw"
        className="nabi-kenburns object-cover"
      />
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
      </div>
    </div>
  );
}
