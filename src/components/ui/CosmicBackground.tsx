"use client";

import { useEffect, useRef } from "react";

const BG = ["#070214", "#14082c"] as const;
const DUST = ["#8b5cf6", "#38bdf8", "#c084fc"] as const;
const LEGACY_THEME_KEYS = ["alnabiy_theme", "alnabiy_cosmic_theme"] as const;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  c: string;
  phase: number;
};

type DustCloud = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  a: number;
  c: string;
  phase: number;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function hexAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function fillSpace(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, BG[0]);
  g.addColorStop(0.45, "#0c0520");
  g.addColorStop(1, BG[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function spawnParticles(count: number, w: number, h: number): Particle[] {
  const out: Particle[] = new Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r: 0.55 + Math.random() * 2,
      a: 0.28 + Math.random() * 0.5,
      c: DUST[i % DUST.length]!,
      phase: Math.random() * Math.PI * 2,
    };
  }
  return out;
}

function spawnDust(w: number, h: number): DustCloud[] {
  const count = 7;
  const out: DustCloud[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const scale = 0.22 + Math.random() * 0.28;
    out[i] = {
      x: Math.random() * w,
      y: Math.random() * h,
      rx: w * scale,
      ry: h * (scale * 0.72),
      a: 0.07 + Math.random() * 0.08,
      c: DUST[i % DUST.length]!,
      phase: Math.random() * Math.PI * 2,
    };
  }
  return out;
}

function drawDust(
  ctx: CanvasRenderingContext2D,
  clouds: DustCloud[],
  time: number
) {
  for (let i = 0; i < clouds.length; i++) {
    const cloud = clouds[i]!;
    const x = cloud.x + Math.sin(time * 0.07 + cloud.phase) * 22;
    const y = cloud.y + Math.cos(time * 0.05 + cloud.phase) * 16;
    const g = ctx.createRadialGradient(x, y, 0, x, y, cloud.rx);
    g.addColorStop(0, hexAlpha(cloud.c, cloud.a));
    g.addColorStop(0.55, hexAlpha(cloud.c, cloud.a * 0.35));
    g.addColorStop(1, hexAlpha(cloud.c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, cloud.rx, cloud.ry, cloud.phase * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function clearLegacyThemeStorage() {
  try {
    for (const key of LEGACY_THEME_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Locked Deep Space Nebula backdrop. One canvas, one rAF loop, paused off-tab.
 */
export function CosmicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    clearLegacyThemeStorage();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    let dust: DustCloud[] = [];
    const reduced = prefersReducedMotion();

    const resize = () => {
      const nextW = window.innerWidth;
      const nextH = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = nextW;
      h = nextH;
      canvas.width = Math.floor(nextW * dpr);
      canvas.height = Math.floor(nextH * dpr);
      canvas.style.width = `${nextW}px`;
      canvas.style.height = `${nextH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const budget = Math.min(
        110,
        Math.max(36, Math.floor((nextW * nextH) / 18000))
      );
      particles = spawnParticles(budget, nextW, nextH);
      dust = spawnDust(nextW, nextH);
    };

    const paintFrame = (time: number) => {
      fillSpace(ctx, w, h);
      ctx.globalCompositeOperation = "lighter";
      drawDust(ctx, dust, time);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        ctx.globalAlpha = p.a * (0.65 + Math.sin(time + p.phase) * 0.2);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    };

    const step = (now: number) => {
      if (!running) return;
      const time = now * 0.001;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        p.x += p.vx + Math.sin(time + p.phase) * 0.18;
        p.y += p.vy + Math.cos(time * 0.7 + p.phase) * 0.16;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
      }

      paintFrame(time);
      raf = window.requestAnimationFrame(step);
    };

    const onVis = () => {
      if (document.hidden) {
        running = false;
        window.cancelAnimationFrame(raf);
        return;
      }
      if (!running && !reduced) {
        running = true;
        raf = window.requestAnimationFrame(step);
      }
    };

    resize();
    if (reduced) {
      paintFrame(0);
    } else {
      raf = window.requestAnimationFrame(step);
    }

    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
