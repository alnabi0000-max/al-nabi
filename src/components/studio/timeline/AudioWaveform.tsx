"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";

type Props = {
  peaks: number[];
  progress: number;
  color: string;
  muted?: boolean;
  className?: string;
};

/** Canvas waveform — peaks 0..1, progress 0..1 for playhead fill. */
export function AudioWaveform({
  peaks,
  progress,
  color,
  muted,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.floor(parent.clientWidth * dpr));
    const h = Math.max(2, Math.floor(parent.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const bars = Math.max(1, peaks.length);
    const gap = Math.max(1, dpr);
    const barW = Math.max(1, (w - gap * (bars - 1)) / bars);
    const mid = h / 2;
    const playedUntil = Math.max(0, Math.min(1, progress)) * w;
    for (let i = 0; i < bars; i++) {
      const peak = muted ? 0.12 : Math.max(0.06, Math.min(1, peaks[i] ?? 0.2));
      const bh = peak * (h * 0.88);
      const x = i * (barW + gap);
      const y = mid - bh / 2;
      ctx.globalAlpha = muted ? 0.28 : x + barW < playedUntil ? 1 : 0.42;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barW, bh);
    }
    ctx.globalAlpha = 1;
  }, [peaks, progress, color, muted]);

  return (
    <canvas
      ref={canvasRef}
      className={clsx("h-full w-full", className)}
      aria-hidden
    />
  );
}
