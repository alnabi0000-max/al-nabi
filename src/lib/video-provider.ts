/**
 * Alnabiy Neural Gateway — thin façade over Enterprise API Dispatcher
 */

import type { CameraMovement } from "./types";
import {
  dispatchImage,
  dispatchVideo,
  CLIP_DURATION_SEC,
} from "@/lib/ai/dispatcher";
import type {
  ImageEngineId,
  RenderQuality,
  VideoEngineId,
  FrameRate,
} from "@/lib/ai/catalog";
import type { CinematicControls } from "@/lib/ai/provider-registry";

export type Quality = RenderQuality;
/** Executable providers, not model-brand labels. */
export type ProviderId = "replicate" | "mock";

/** @deprecated use VideoEngineId from catalog — kept for script pipeline compat */
export type VideoEngine =
  | VideoEngineId
  | "wan-2.5"
  | "minimax"
  | "auto";

export { CLIP_DURATION_SEC };

export function resolveVideoEngine(quality: Quality): VideoEngineId {
  if (quality === "8K" || quality === "4K") return "kling-v3";
  return "auto";
}

/** Rasm: FLUX.1 Pro / SD3.5 / gateway */
export async function generateImage(opts: {
  prompt: string;
  aspect?: "16:9" | "9:16" | "1:1";
  engine?: ImageEngineId | string;
  quality?: Quality;
  imageUrl?: string;
}): Promise<{ url: string; provider: string; model: string; engineId?: string }> {
  return dispatchImage({
    prompt: opts.prompt,
    aspect: opts.aspect,
    engine: opts.engine || "auto",
    quality: opts.quality,
    imageUrl: opts.imageUrl,
  });
}

/** Video: Al-Nabi Cinematic / Motion routes via gateway */
export async function generateVideoClip(opts: {
  prompt: string;
  imageUrl?: string;
  endImageUrl?: string;
  cameraMove?: CameraMovement;
  quality?: Quality;
  engine?: VideoEngine | string;
  durationSec?: number;
  frameRate?: FrameRate | number;
  aspect?: "16:9" | "9:16" | "1:1";
  sourceVideoId?: string;
  cinematicControls?: CinematicControls;
}): Promise<{ url: string; provider: string; model: string; engineId?: string }> {
  const quality = opts.quality || "1080p";
  const engine = opts.engine || resolveVideoEngine(quality);
  return dispatchVideo({
    prompt: opts.prompt,
    imageUrl: opts.imageUrl,
    endImageUrl: opts.endImageUrl,
    cameraMove: opts.cameraMove,
    quality,
    engine,
    durationSec: opts.durationSec,
    frameRate: opts.frameRate,
    aspect: opts.aspect,
    sourceVideoId: opts.sourceVideoId,
    cinematicControls: opts.cinematicControls,
  });
}
