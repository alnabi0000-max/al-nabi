"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import {
  TEMPLATE_POSTER_SRC,
  initialTemplatePreviewSrc,
  nextTemplatePreviewSrc,
} from "@/lib/templates/preview";

type Props = {
  templateId: number;
  previewVideo: string;
  className?: string;
  videoClassName?: string;
  /** Autoplay when mounted (drawer). */
  autoPlay?: boolean;
  /** Defer video src until hover — avoids mass preview requests on grid. */
  loadOnHover?: boolean;
  /** Never fetch remote mp4 — static poster only (Studio featured strip). */
  posterOnly?: boolean;
};

/**
 * Template preview: poster by default; optional hover video with one fallback.
 * Clears `src` after failure so the browser stops retries.
 */
export function TemplatePreviewMedia({
  templateId,
  previewVideo,
  className,
  videoClassName,
  autoPlay = false,
  loadOnHover = false,
  posterOnly = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const triedFallback = useRef(false);
  const wantPlay = useRef(autoPlay && !loadOnHover && !posterOnly);
  const [failed, setFailed] = useState(posterOnly);
  const [src, setSrc] = useState<string | null>(() => {
    if (posterOnly || loadOnHover) return null;
    return initialTemplatePreviewSrc({
      id: templateId,
      preview_video: previewVideo,
    });
  });

  useEffect(() => {
    if (posterOnly || !src || failed || !wantPlay.current) return;
    const v = videoRef.current;
    if (!v) return;
    void v.play().catch(() => undefined);
  }, [src, failed, posterOnly]);

  const play = useCallback(() => {
    if (posterOnly || failed) return;
    wantPlay.current = true;
    setSrc((prev) => {
      if (prev) return prev;
      return (
        initialTemplatePreviewSrc({
          id: templateId,
          preview_video: previewVideo,
        }) ?? null
      );
    });
    const v = videoRef.current;
    if (v) void v.play().catch(() => undefined);
  }, [failed, posterOnly, previewVideo, templateId]);

  const reset = useCallback(() => {
    wantPlay.current = false;
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    try {
      v.currentTime = 0;
    } catch {
      /* soft */
    }
  }, []);

  const onError = useCallback(() => {
    if (!src) return;
    if (!triedFallback.current) {
      triedFallback.current = true;
      const next = nextTemplatePreviewSrc(templateId, src);
      if (next) {
        setSrc(next);
        return;
      }
    }
    setFailed(true);
    setSrc(null);
    const v = videoRef.current;
    if (v) {
      v.removeAttribute("src");
      try {
        v.load();
      } catch {
        /* soft */
      }
    }
  }, [src, templateId]);

  const showPoster = posterOnly || failed || !src;

  return (
    <div
      className={clsx(
        "relative h-full w-full overflow-hidden bg-nabi-surface",
        className
      )}
      onMouseEnter={!posterOnly && loadOnHover ? play : undefined}
      onMouseLeave={!posterOnly && loadOnHover ? reset : undefined}
    >
      <Image
        src={TEMPLATE_POSTER_SRC}
        alt=""
        fill
        sizes="(max-width: 768px) 50vw, 240px"
        className={clsx(
          "object-cover transition-opacity duration-200",
          showPoster ? "opacity-100" : "opacity-0"
        )}
        draggable={false}
        unoptimized
      />
      {!posterOnly && !failed && src ? (
        <video
          ref={videoRef}
          key={src}
          src={src}
          muted
          loop
          playsInline
          autoPlay={autoPlay && !loadOnHover}
          preload="none"
          className={clsx(
            "relative z-[1] h-full w-full object-cover",
            videoClassName
          )}
          onError={onError}
        />
      ) : null}
    </div>
  );
}
