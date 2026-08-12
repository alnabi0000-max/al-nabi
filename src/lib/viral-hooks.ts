/**
 * Viral Preview & Clickbait Hook Generator — matnlar faol til JSON dan
 */

import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { t, resolveLocale } from "@/lib/i18n/messages";
import type { LocaleCode } from "@/lib/i18n/config";

export interface ViralHookPack {
  frames: {
    index: number;
    label: string;
    mockUrl: string;
    timeSec: number;
    /** false when this is a generic placeholder, not an actual extracted frame */
    isReal: boolean;
  }[];
  thumbnails: { title: string; neonClass: string }[];
  hooks: string[];
  note?: string;
  locale: LocaleCode;
}

function runFfmpeg(args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

function buildClickbait(
  locale: LocaleCode,
  scriptOrPrompt: string,
  emotion: string
): string[] {
  const snippet = scriptOrPrompt.trim().slice(0, 48) || "Alnabiy";
  return [
    t(locale, "viral_hook_wait", { snippet }),
    t(locale, "viral_hook_ending"),
    t(locale, "viral_hook_mode", { emotion: emotion.toUpperCase() }),
  ].map((x) => x.slice(0, 72));
}

function buildHooks(
  locale: LocaleCode,
  scriptOrPrompt: string,
  emotion: string
): string[] {
  const word =
    scriptOrPrompt.trim().split(/\s+/).slice(0, 4).join(" ") || "Alnabiy";
  return [
    t(locale, "viral_hook_watch", { word }),
    t(locale, "viral_hook_twist", { emotion }),
    t(locale, "viral_hook_scroll", { word }),
  ];
}

export async function generateViralPack(opts: {
  videoUrl?: string | null;
  scriptOrPrompt: string;
  emotionMode?: string;
  durationSec?: number;
  jobId?: string;
  locale?: string;
}): Promise<ViralHookPack> {
  const locale = resolveLocale(opts.locale);
  const emotion = opts.emotionMode || "epic";
  const emotionLabel = t(locale, `emotion_${emotion}`) || emotion;
  const duration = Math.max(6, opts.durationSec || 30);
  const times = [
    Math.max(0.5, duration * 0.25),
    Math.max(1, duration * 0.5),
    Math.max(1.5, duration * 0.75),
  ];

  const thumbnails = buildClickbait(
    locale,
    opts.scriptOrPrompt,
    emotionLabel
  ).map((title, i) => ({
    title,
    neonClass:
      i === 0
        ? "from-[var(--accent-from)] to-[var(--accent-to)]"
        : i === 1
          ? "from-nabi-gold to-[var(--accent-to)]"
          : "from-nabi-neon to-nabi-gold",
  }));
  const hooks = buildHooks(locale, opts.scriptOrPrompt, emotionLabel);

  const storage = process.env.STORAGE_DIR || "./storage";
  /* Unguessable — a predictable timestamp-based id let anyone enumerate and
   * view other users' generated frames via GET /api/viral/frame. */
  const jobId = opts.jobId || `viral_${randomUUID()}`;
  const outDir = path.join(storage, "viral", jobId);
  let ffmpegOk = false;
  const frames: ViralHookPack["frames"] = [];

  if (opts.videoUrl?.startsWith("http") || opts.videoUrl?.startsWith("/")) {
    try {
      await fs.mkdir(outDir, { recursive: true });
      for (let i = 0; i < 3; i++) {
        const out = path.join(outDir, `frame_${i + 1}.jpg`);
        const ok = await runFfmpeg([
          "-y",
          "-ss",
          String(times[i].toFixed(2)),
          "-i",
          opts.videoUrl,
          "-frames:v",
          "1",
          "-q:v",
          "2",
          out,
        ]);
        frames.push({
          index: i + 1,
          label: `${t(locale, "peak_frame")} #${i + 1}`,
          mockUrl: ok
            ? `/api/viral/frame?job=${encodeURIComponent(jobId)}&i=${i + 1}`
            : `https://placehold.co/640x360/0d0f12/a855f7/png?text=Alnabiy+${i + 1}`,
          timeSec: Number(times[i].toFixed(1)),
          isReal: ok,
        });
        if (ok) ffmpegOk = true;
      }
    } catch {
      /* mock */
    }
  }

  if (frames.length === 0) {
    for (let i = 0; i < 3; i++) {
      frames.push({
        index: i + 1,
        label: `${t(locale, "peak_frame")} #${i + 1}`,
        mockUrl: `https://placehold.co/640x360/121418/22d3ee/png?text=Alnabiy+${i + 1}`,
        timeSec: Number(times[i].toFixed(1)),
        isReal: false,
      });
    }
  }

  return {
    frames,
    thumbnails,
    hooks,
    note: ffmpegOk ? t(locale, "ffmpeg_ok") : t(locale, "ffmpeg_mock"),
    locale,
  };
}
