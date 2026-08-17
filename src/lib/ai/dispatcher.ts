/**
 * Enterprise API Dispatcher — 3-provider architecture
 *
 * 1. OpenRouter  → text / prompt (llm.ts)
 * 2. Replicate   → video / image (this file)
 * 3. ElevenLabs  → audio (audio.ts)
 */

import type { CameraMovement } from "@/lib/types";
import {
  composeDirectorPrompt,
  type FrameRate,
  type ImageEngineId,
  type RenderQuality,
  type VideoEngineId,
} from "@/lib/ai/catalog";
import {
  CLIP_DURATION_SEC,
  generateReplicateImage,
  generateReplicateVideo,
  isReplicateConfigured,
} from "@/lib/replicate";
import { expandPromptForVideoGeneration } from "@/lib/ai/prompt-expander";
import { whiteLabelEngine, whiteLabelModel } from "@/lib/models";

export type DispatchResult = {
  url: string;
  provider: string;
  model: string;
  engineId: string;
};

export type DispatchVideoInput = {
  prompt: string;
  imageUrl?: string;
  endImageUrl?: string;
  engine?: VideoEngineId | string;
  cameraMove?: CameraMovement;
  quality?: RenderQuality | string;
  frameRate?: FrameRate | number;
  durationSec?: number;
  aspect?: "16:9" | "9:16" | "1:1";
};

export type DispatchImageInput = {
  prompt: string;
  engine?: ImageEngineId | string;
  aspect?: "16:9" | "9:16" | "1:1";
  quality?: RenderQuality | string;
  imageUrl?: string;
};

function publicize(
  r: { url: string; provider: string; model: string; engineId?: string },
  engineId: string
): DispatchResult {
  return {
    url: r.url,
    provider: whiteLabelEngine(r.provider),
    model: whiteLabelModel(r.model),
    engineId: r.engineId || engineId,
  };
}

/**
 * Video — Replicate only (Kling / Luma Ray-2 / Wan / MiniMax)
 */
export async function dispatchVideo(
  opts: DispatchVideoInput
): Promise<DispatchResult> {
  const engine = (opts.engine || "auto") as VideoEngineId;
  const prompt = composeDirectorPrompt(expandPromptForVideoGeneration(opts.prompt), {
    cameraMove: opts.cameraMove,
    quality: opts.quality as RenderQuality | undefined,
    frameRate: opts.frameRate as FrameRate | undefined,
  });

  if (!isReplicateConfigured()) {
    /* Never charge a user for a placeholder — caller must fail + refund. */
    throw new Error("REPLICATE_NOT_CONFIGURED");
  }

  const raw = await generateReplicateVideo({
    prompt,
    imageUrl: opts.imageUrl,
    endImageUrl: opts.endImageUrl,
    cameraMove: opts.cameraMove,
    engine,
    durationSec: opts.durationSec,
    aspect: opts.aspect,
    quality: opts.quality,
  });

  return publicize(raw, engine);
}

/**
 * Image — Replicate only (FLUX.1 Pro / SD3.5)
 */
export async function dispatchImage(
  opts: DispatchImageInput
): Promise<DispatchResult> {
  const engine = (opts.engine || "auto") as ImageEngineId;

  if (!isReplicateConfigured()) {
    /* Never charge a user for a placeholder — caller must fail + refund. */
    throw new Error("REPLICATE_NOT_CONFIGURED");
  }

  const raw = await generateReplicateImage({
    prompt: opts.prompt,
    aspect: opts.aspect,
    engine,
    quality: opts.quality,
    imageUrl: opts.imageUrl,
  });

  return publicize(raw, engine);
}

export { CLIP_DURATION_SEC };
