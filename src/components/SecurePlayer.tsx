"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMaster } from "@/context/MasterControllerContext";
import { WATERMARK } from "@/lib/credits";
import { shouldBypassLowDataMode } from "@/lib/security/client-mode";

interface Props {
  src?: string | null;
  autoPlay?: boolean;
  muted?: boolean;
}

/**
 * Toza video pleyer.
 * Localhost/dev: low-data saver bloklanmaydi — autoplay ishlaydi.
 */
export function SecurePlayer({
  src,
  autoPlay = true,
  muted = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { tr, lowDataMode } = useMaster();
  const dataBlocked = useMemo(
    () => lowDataMode && !shouldBypassLowDataMode(),
    [lowDataMode]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || !autoPlay || dataBlocked) return;
    video.muted = true;
    video.playsInline = true;
    const tryPlay = () => {
      void video.play().catch(() => {});
    };
    tryPlay();
    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    return () => {
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
    };
  }, [src, autoPlay, dataBlocked]);

  /* Silent capture blackout (SecurityProvider) */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onCapture = (e: Event) => {
      const active = (e as CustomEvent<{ active?: boolean }>).detail?.active;
      if (active) {
        video.pause();
        video.style.filter = "brightness(0)";
        video.style.opacity = "0";
      } else {
        video.style.filter = "";
        video.style.opacity = "";
      }
    };
    window.addEventListener("alnabiy:capture", onCapture as EventListener);
    return () =>
      window.removeEventListener("alnabiy:capture", onCapture as EventListener);
  }, [src]);

  return (
    <div
      className="relative aspect-video overflow-hidden rounded-xl bg-black"
      data-alnabiy-secure="1"
    >
      {dataBlocked && (
        <div className="absolute inset-x-0 top-0 z-20 bg-amber-500/20 px-2 py-1 text-center text-[10px] text-amber-300">
          {tr("low_data_warning")}
        </div>
      )}
      {src && !dataBlocked ? (
        <video
          ref={videoRef}
          key={src}
          src={src}
          controls
          playsInline
          autoPlay={autoPlay}
          muted={muted || autoPlay}
          preload="metadata"
          className="h-full w-full object-contain bg-black"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-zinc-400">
          {WATERMARK}
        </div>
      )}
    </div>
  );
}
