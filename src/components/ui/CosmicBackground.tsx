"use client";

import { useEffect, useRef } from "react";
import { useCosmicTheme } from "@/context/CosmicThemeContext";
import type { CosmicThemeId } from "@/lib/theme/cosmic";

type Mode =
  | "float"
  | "swirl"
  | "aurora"
  | "vortex"
  | "grid"
  | "warp"
  | "ocean"
  | "matrix";

type ThemePaint = {
  bg: [string, string];
  colors: string[];
  mode: Mode;
};

const PAINT: Record<CosmicThemeId, ThemePaint> = {
  pandora: {
    bg: ["#03140f", "#06261c"],
    colors: ["#34d399", "#22d3ee", "#6ee7b7"],
    mode: "float",
  },
  nebula: {
    bg: ["#070214", "#14082c"],
    colors: ["#8b5cf6", "#38bdf8", "#c084fc"],
    mode: "swirl",
  },
  aurora: {
    bg: ["#04110f", "#0b0820"],
    colors: ["#4ade80", "#e879f9", "#22d3ee"],
    mode: "aurora",
  },
  grotto: {
    bg: ["#0c0618", "#1a0b2e"],
    colors: ["#c084fc", "#a78bfa", "#67e8f9"],
    mode: "float",
  },
  vortex: {
    bg: ["#120c06", "#1c1408"],
    colors: ["#fbbf24", "#d97706", "#fdba74"],
    mode: "vortex",
  },
  plasma: {
    bg: ["#07010f", "#120418"],
    colors: ["#22d3ee", "#f472b6", "#67e8f9"],
    mode: "grid",
  },
  warp: {
    bg: ["#02040a", "#070b16"],
    colors: ["#e2e8f0", "#93c5fd", "#f8fafc"],
    mode: "warp",
  },
  abyss: {
    bg: ["#020912", "#041821"],
    colors: ["#22d3ee", "#2dd4bf", "#67e8f9"],
    mode: "ocean",
  },
  matrix: {
    bg: ["#020604", "#06140a"],
    colors: ["#4ade80", "#166534", "#86efac"],
    mode: "matrix",
  },
  golden: {
    bg: ["#0a0804", "#161008"],
    colors: ["#fbbf24", "#f59e0b", "#fde68a"],
    mode: "swirl",
  },
};

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  r: number;
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

function fillBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  paint: ThemePaint
) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, paint.bg[0]);
  g.addColorStop(1, paint.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function spawnParticles(
  count: number,
  w: number,
  h: number,
  colors: string[]
): Particle[] {
  const out: Particle[] = new Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = {
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random(),
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: 0.6 + Math.random() * 2.2,
      a: 0.25 + Math.random() * 0.55,
      c: colors[i % colors.length]!,
      phase: Math.random() * Math.PI * 2,
    };
  }
  return out;
}

/**
 * GPU-friendly cosmic backdrop. One canvas, one rAF loop, paused off-tab.
 */
export function CosmicBackground() {
  const { theme } = useCosmicTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let t0 = performance.now();
    const reduced = prefersReducedMotion();

    const resize = () => {
      const nextW = window.innerWidth;
      const nextH = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = nextW;
      h = nextH;
      canvas.width = Math.floor(nextW * dpr);
      canvas.height = Math.floor(nextH * dpr);
      canvas.style.width = `${nextW}px`;
      canvas.style.height = `${nextH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const budget = Math.min(110, Math.max(36, Math.floor((nextW * nextH) / 18000)));
      particles = spawnParticles(budget, nextW, nextH, PAINT[theme].colors);
    };

    const drawStatic = () => {
      fillBackdrop(ctx, w, h, PAINT[theme]);
    };

    const step = (now: number) => {
      if (!running) return;
      const paint = PAINT[theme];
      const dt = Math.min(32, now - t0);
      t0 = now;
      const time = now * 0.001;

      fillBackdrop(ctx, w, h, paint);
      ctx.globalCompositeOperation = "lighter";

      if (paint.mode === "aurora") {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          const y0 = h * (0.22 + i * 0.18);
          ctx.moveTo(0, y0);
          for (let x = 0; x <= w; x += 18) {
            const y =
              y0 +
              Math.sin(x * 0.008 + time * (0.7 + i * 0.2) + i) * (28 + i * 10);
            ctx.lineTo(x, y);
          }
          ctx.strokeStyle = paint.colors[i % paint.colors.length]!;
          ctx.globalAlpha = 0.12;
          ctx.lineWidth = 18 - i * 4;
          ctx.stroke();
        }
      }

      if (paint.mode === "grid") {
        ctx.globalAlpha = 0.16;
        ctx.lineWidth = 1;
        const offset = (time * 28) % 42;
        ctx.strokeStyle = paint.colors[0]!;
        for (let x = -42 + offset; x < w; x += 42) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + h * 0.12, h);
          ctx.stroke();
        }
        ctx.strokeStyle = paint.colors[1]!;
        for (let y = -42 + offset; y < h; y += 42) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y + 8);
          ctx.stroke();
        }
      }

      const cx = w * 0.5;
      const cy = h * 0.5;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        if (paint.mode === "warp") {
          p.z -= 0.006 * (dt / 16);
          if (p.z <= 0.05) {
            p.z = 1;
            p.x = (Math.random() - 0.5) * w;
            p.y = (Math.random() - 0.5) * h;
          }
          const sx = cx + (p.x * 0.55) / p.z;
          const sy = cy + (p.y * 0.55) / p.z;
          ctx.globalAlpha = Math.min(0.85, (1 - p.z) * p.a);
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.4, p.r * (1.4 - p.z)), 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        if (paint.mode === "vortex") {
          const ang = Math.atan2(p.y - cy, p.x - cx) + 0.008 * (dt / 16);
          const dist = Math.hypot(p.x - cx, p.y - cy) || 1;
          const nd = dist + Math.sin(time + p.phase) * 0.15;
          p.x = cx + Math.cos(ang) * nd;
          p.y = cy + Math.sin(ang) * nd;
        } else if (paint.mode === "swirl") {
          p.x += p.vx + Math.sin(time + p.phase) * 0.18;
          p.y += p.vy + Math.cos(time * 0.7 + p.phase) * 0.16;
        } else if (paint.mode === "matrix") {
          p.y += (0.9 + p.z * 1.8) * (dt / 16);
          if (p.y > h + 8) {
            p.y = -8;
            p.x = Math.random() * w;
          }
        } else if (paint.mode === "ocean") {
          p.x += Math.sin(time * 0.4 + p.phase) * 0.22;
          p.y += p.vy * 0.35 + Math.cos(time * 0.3 + p.phase) * 0.12;
        } else {
          p.x += p.vx + Math.sin(time + p.phase) * 0.12;
          p.y += p.vy;
        }

        if (paint.mode !== "matrix") {
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10;
          if (p.y > h + 10) p.y = -10;
        }

        ctx.globalAlpha = p.a * (0.65 + Math.sin(time + p.phase) * 0.2);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
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
        t0 = performance.now();
        raf = window.requestAnimationFrame(step);
      }
    };

    resize();
    if (reduced) {
      drawStatic();
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
  }, [theme]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.style.opacity = "0";
    const id = window.setTimeout(() => {
      wrap.style.opacity = "1";
    }, 40);
    return () => window.clearTimeout(id);
  }, [theme]);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-300"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
