/**
 * Alnabiy Smart Director — Frame Synchronizer
 * Ssenariy so'zlari ↔ audio timestamps ↔ Cinema Motion / Realism kadrlari
 */

import type { WordTiming } from "@/lib/audio";
import type { CameraMovement } from "@/lib/types";

export interface DirectorFrame {
  /** 0-based frame index */
  frameIndex: number;
  /** Absolute time on timeline (ms) */
  timeMs: number;
  /** Frame duration (ms) */
  durationMs: number;
  /** Words spoken during this frame */
  words: string[];
  wordStartMs: number;
  wordEndMs: number;
  /** Visual prompt slice for Wan / Flux */
  visualPrompt: string;
  cameraHint: CameraMovement | "cut" | "hold";
  beat: "setup" | "action" | "emphasis" | "pause" | "resolve";
}

export interface DirectorPlan {
  fps: number;
  totalDurationMs: number;
  totalFrames: number;
  frames: DirectorFrame[];
  engine: "wan-2.5" | "flux" | "hybrid";
  syncVersion: "1.0";
}

export interface SceneCue {
  index: number;
  visual_prompt: string;
  voice_text: string;
  camera_movement?: string;
  duration?: number;
}

const DEFAULT_FPS = 24;

function beatFromWord(word: string, idx: number, total: number): DirectorFrame["beat"] {
  if (/[.!?]$/.test(word)) return "emphasis";
  if (/,$/.test(word)) return "pause";
  if (idx < total * 0.15) return "setup";
  if (idx > total * 0.85) return "resolve";
  return "action";
}

function cameraForBeat(
  beat: DirectorFrame["beat"],
  fallback?: string
): DirectorFrame["cameraHint"] {
  if (fallback && fallback !== "static") {
    return fallback as CameraMovement;
  }
  switch (beat) {
    case "setup":
      return "static";
    case "action":
      return "pan_left";
    case "emphasis":
      return "zoom_in";
    case "pause":
      return "hold";
    case "resolve":
      return "zoom_out";
    default:
      return "static";
  }
}

/**
 * So'z taymerlarini fps asosida kadr ketma-ketligiga bog'laydi
 */
export function syncWordsToFrames(opts: {
  words: WordTiming[];
  visualPrompt: string;
  fps?: number;
  cameraMovement?: string;
  engine?: DirectorPlan["engine"];
  /** Agar audio bo'sh bo'lsa — taxminiy davomiylik */
  fallbackDurationMs?: number;
}): DirectorPlan {
  const fps = opts.fps || DEFAULT_FPS;
  const frameMs = 1000 / fps;
  const words = opts.words.length
    ? opts.words
    : [
        {
          word: opts.visualPrompt.slice(0, 12) || "beat",
          startMs: 0,
          endMs: opts.fallbackDurationMs || 3000,
        },
      ];

  const totalDurationMs = Math.max(
    words[words.length - 1].endMs,
    opts.fallbackDurationMs || 0,
    frameMs
  );
  const totalFrames = Math.max(1, Math.ceil(totalDurationMs / frameMs));

  // Har bir so'z uchun markaziy kadr + hold
  const frames: DirectorFrame[] = [];
  const promptParts = opts.visualPrompt
    .split(/[,.;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const total = words.length;

  words.forEach((w, i) => {
    const startFrame = Math.floor(w.startMs / frameMs);
    const endFrame = Math.max(startFrame + 1, Math.ceil(w.endMs / frameMs));
    const beat = beatFromWord(w.word, i, total);
    const slice =
      promptParts[i % Math.max(1, promptParts.length)] || opts.visualPrompt;

    for (let f = startFrame; f < endFrame && f < totalFrames; f++) {
      const existing = frames.find((x) => x.frameIndex === f);
      if (existing) {
        existing.words.push(w.word);
        existing.wordEndMs = w.endMs;
        continue;
      }
      frames.push({
        frameIndex: f,
        timeMs: Math.round(f * frameMs),
        durationMs: Math.round(frameMs),
        words: [w.word],
        wordStartMs: w.startMs,
        wordEndMs: w.endMs,
        visualPrompt: `${slice}. Lip-sync timed at ${w.startMs}ms.`,
        cameraHint: cameraForBeat(beat, opts.cameraMovement),
        beat,
      });
    }
  });

  // Bo'sh freymlar — hold
  frames.sort((a, b) => a.frameIndex - b.frameIndex);
  const filled: DirectorFrame[] = [];
  let last = frames[0];
  for (let f = 0; f < totalFrames; f++) {
    const hit = frames.find((x) => x.frameIndex === f);
    if (hit) {
      filled.push(hit);
      last = hit;
    } else if (last) {
      filled.push({
        ...last,
        frameIndex: f,
        timeMs: Math.round(f * frameMs),
        durationMs: Math.round(frameMs),
        words: [],
        beat: "pause",
        cameraHint: "hold",
        visualPrompt: `${last.visualPrompt} (hold)`,
      });
    }
  }

  return {
    fps,
    totalDurationMs,
    totalFrames,
    frames: filled,
    engine: opts.engine || "hybrid",
    syncVersion: "1.0",
  };
}

/**
 * Ko'p sahnani bitta director timeline ga yig'ish
 */
export function buildMovieDirectorPlan(opts: {
  scenes: Array<{
    visual_prompt: string;
    voice_text: string;
    camera_movement?: string;
    words?: WordTiming[];
    durationMs?: number;
  }>;
  fps?: number;
  engine?: DirectorPlan["engine"];
}): DirectorPlan {
  const fps = opts.fps || DEFAULT_FPS;
  const frameMs = 1000 / fps;
  const allFrames: DirectorFrame[] = [];
  let cursorMs = 0;

  for (const scene of opts.scenes) {
    const plan = syncWordsToFrames({
      words: scene.words || [],
      visualPrompt: scene.visual_prompt,
      fps,
      cameraMovement: scene.camera_movement,
      engine: opts.engine,
      fallbackDurationMs:
        scene.durationMs ||
        Math.max(2000, (scene.voice_text.split(/\s+/).length / 145) * 60 * 1000),
    });

    for (const fr of plan.frames) {
      allFrames.push({
        ...fr,
        frameIndex: Math.round((cursorMs + fr.timeMs) / frameMs),
        timeMs: cursorMs + fr.timeMs,
      });
    }
    cursorMs += plan.totalDurationMs;
  }

  const totalDurationMs = cursorMs;
  const totalFrames = Math.max(1, Math.ceil(totalDurationMs / frameMs));

  return {
    fps,
    totalDurationMs,
    totalFrames,
    frames: allFrames,
    engine: opts.engine || "hybrid",
    syncVersion: "1.0",
  };
}

/**
 * Director plan → Wan 2.5 / Flux keyframe promptlari
 */
export function planToKeyframePrompts(
  plan: DirectorPlan,
  everyMs = 500
): Array<{ timeMs: number; prompt: string; camera: string }> {
  const out: Array<{ timeMs: number; prompt: string; camera: string }> = [];
  let next = 0;
  for (const fr of plan.frames) {
    if (fr.timeMs < next) continue;
    out.push({
      timeMs: fr.timeMs,
      prompt: fr.visualPrompt,
      camera: String(fr.cameraHint),
    });
    next = fr.timeMs + everyMs;
  }
  return out;
}
