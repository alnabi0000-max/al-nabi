/**
 * Replicate Dispatcher — yagona Video & Image generation handler
 * Key: REPLICATE_API_KEY (legacy: REPLICATE_API_TOKEN)
 *
 * Engines (Replicate model IDs):
 *  - FLUX.1 Pro → black-forest-labs/flux-1.1-pro
 *  - Kling v2.5/v3 → kwaivgi/kling-*
 *  - Luma Ray-2 → luma ray model on Replicate
 *  - Wan / MiniMax → gateway fallbacks
 */

import Replicate from "replicate";
import type { CameraMovement } from "@/lib/types";
import { WATERMARK, PROMPT_TO_VIDEO_CLIP_SEC } from "@/lib/credits";
import type { ImageEngineId, VideoEngineId } from "@/lib/ai/catalog";
import { getResolvedModelId } from "@/lib/admin/model-registry";
import { resolveNegativePrompt } from "@/lib/ai/negative-prompt";

/** Render + billable ceiling for a single P2V clip (shared with credits.ts). */
export const CLIP_DURATION_SEC = PROMPT_TO_VIDEO_CLIP_SEC;

/** Preferred: REPLICATE_API_KEY · fallback: REPLICATE_API_TOKEN */
export function getReplicateApiKey(): string | null {
  const key =
    process.env.REPLICATE_API_KEY?.trim() ||
    process.env.REPLICATE_API_TOKEN?.trim();
  if (!key || key.includes("...") || key === "r8_...") return null;
  return key;
}

export function isReplicateConfigured(): boolean {
  return Boolean(getReplicateApiKey());
}

/** Defaults — runtime overrides via admin model-registry (no core logic change). */
const REPLICATE_MODEL_DEFAULTS = {
  flux: "black-forest-labs/flux-1.1-pro",
  sd35: "stability-ai/stable-diffusion-3.5-large",
  kling25: "kwaivgi/kling-v2.1",
  kling3: "kwaivgi/kling-v2.1-master",
  lumaRay2: "luma/ray",
  runway: "minimax/video-01",
  wan: "wavespeedai/wan-2.1-t2v-720p",
  minimax: "minimax/video-01",
} as const;

export type ReplicateModelSlot = keyof typeof REPLICATE_MODEL_DEFAULTS;

function modelSlot(slot: ReplicateModelSlot, envKey: string, fallback: string) {
  return (
    getResolvedModelId(slot) ||
    process.env[envKey]?.trim() ||
    fallback
  );
}

export const REPLICATE_MODELS = {
  get flux() {
    return modelSlot("flux", "REPLICATE_FLUX_MODEL", REPLICATE_MODEL_DEFAULTS.flux);
  },
  get sd35() {
    return modelSlot("sd35", "REPLICATE_SD35_MODEL", REPLICATE_MODEL_DEFAULTS.sd35);
  },
  get kling25() {
    return modelSlot(
      "kling25",
      "REPLICATE_KLING_V25_MODEL",
      REPLICATE_MODEL_DEFAULTS.kling25
    );
  },
  get kling3() {
    return modelSlot(
      "kling3",
      "REPLICATE_KLING_V3_MODEL",
      REPLICATE_MODEL_DEFAULTS.kling3
    );
  },
  get lumaRay2() {
    return modelSlot(
      "lumaRay2",
      "REPLICATE_LUMA_MODEL",
      REPLICATE_MODEL_DEFAULTS.lumaRay2
    );
  },
  get runway() {
    return modelSlot(
      "runway",
      "REPLICATE_RUNWAY_MODEL",
      REPLICATE_MODEL_DEFAULTS.runway
    );
  },
  get wan() {
    return modelSlot("wan", "REPLICATE_WAN_MODEL", REPLICATE_MODEL_DEFAULTS.wan);
  },
  get minimax() {
    return modelSlot(
      "minimax",
      "REPLICATE_MINIMAX_MODEL",
      REPLICATE_MODEL_DEFAULTS.minimax
    );
  },
};

/** @deprecated use VideoEngineId — kept for callers */
export type VideoEngine = VideoEngineId | "wan-2.5" | "minimax" | "auto";

function client(): Replicate | null {
  const token = getReplicateApiKey();
  if (!token) return null;
  return new Replicate({ auth: token });
}

function withCamera(prompt: string, camera?: CameraMovement): string {
  if (!camera || camera === "static") {
    return `${prompt}. Photoreal cinematic, ${WATERMARK} grade.`;
  }
  const map: Record<string, string> = {
    zoom_in: "slow cinematic zoom in",
    zoom_out: "slow reveal zoom out",
    pan_left: "smooth pan left",
    pan_right: "smooth pan right",
    tilt_up: "camera tilt up",
    tilt_down: "camera tilt down",
    slow_mo: "dramatic slow motion",
    orbit: "orbital camera around subject",
  };
  return `${prompt}. Camera: ${map[camera] || camera}. ${WATERMARK} grade.`;
}

export function extractReplicateUrl(output: unknown): string {
  if (!output) return "";
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return extractReplicateUrl(output[0]);
  if (typeof output === "object" && output !== null) {
    const o = output as Record<string, unknown>;
    if (typeof o.url === "string") return o.url;
    if (typeof o.href === "string") return o.href;
    if (typeof (o as { toString?: () => string }).toString === "function") {
      const s = String(output);
      if (s.startsWith("http")) return s;
    }
  }
  return String(output);
}

/** Image jobs are quick; video jobs (Kling/Luma/Wan/MiniMax) can take minutes. */
const REPLICATE_IMAGE_TIMEOUT_MS = 90_000;
const REPLICATE_VIDEO_TIMEOUT_MS = 240_000;

async function runModel(
  model: string,
  input: Record<string, unknown>,
  timeoutMs: number = REPLICATE_VIDEO_TIMEOUT_MS
): Promise<string> {
  const rep = client();
  if (!rep) throw new Error("REPLICATE_API_KEY not configured");
  let output: unknown;
  try {
    output = await rep.run(model as `${string}/${string}`, {
      input,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new Error(`Replicate ${model}: timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw e;
  }
  const url = extractReplicateUrl(output);
  if (!url || url === "[object Object]") {
    throw new Error(`Replicate ${model}: empty output`);
  }
  return url;
}

/** Never charge a user for a placeholder — always throw so callers fail + refund. */
function requireReplicateClient(): void {
  if (!client()) throw new Error("REPLICATE_NOT_CONFIGURED");
}

/** FLUX.1 Pro still — no native negative_prompt; quality via positive prompt only. */
export async function generateFluxImage(opts: {
  prompt: string;
  aspect?: "16:9" | "9:16" | "1:1";
}): Promise<{ url: string; provider: "replicate"; model: string }> {
  const model = REPLICATE_MODELS.flux;
  requireReplicateClient();

  const aspectRatio =
    opts.aspect === "9:16" ? "9:16" : opts.aspect === "1:1" ? "1:1" : "16:9";

  const url = await runModel(
    model,
    {
      prompt: `${opts.prompt}. Ultra detailed, ${WATERMARK} quality still.`,
      aspect_ratio: aspectRatio,
      output_format: "png",
      safety_tolerance: 2,
    },
    REPLICATE_IMAGE_TIMEOUT_MS
  );
  return { url, provider: "replicate", model };
}

/** SD3.5 Large (optional image engine) */
export async function generateSd35Image(opts: {
  prompt: string;
  aspect?: "16:9" | "9:16" | "1:1";
}): Promise<{ url: string; provider: "replicate"; model: string }> {
  const model = REPLICATE_MODELS.sd35;
  requireReplicateClient();

  const aspectRatio =
    opts.aspect === "9:16" ? "9:16" : opts.aspect === "1:1" ? "1:1" : "16:9";

  const url = await runModel(
    model,
    {
      prompt: opts.prompt,
      negative_prompt: resolveNegativePrompt(opts.prompt),
      aspect_ratio: aspectRatio,
      output_format: "png",
    },
    REPLICATE_IMAGE_TIMEOUT_MS
  );
  return { url, provider: "replicate", model };
}

type VideoOpts = {
  prompt: string;
  imageUrl?: string;
  cameraMove?: CameraMovement;
  durationSec?: number;
  aspect?: "16:9" | "9:16" | "1:1";
};

/**
 * Shared video provider input. Always attaches a conflict-aware negative_prompt
 * (silent quality gate — not shown to the user). Callers may override via extra.
 */
function videoInput(opts: VideoOpts, extra: Record<string, unknown> = {}) {
  const prompt = withCamera(opts.prompt, opts.cameraMove);
  const seconds = Math.min(
    CLIP_DURATION_SEC,
    opts.durationSec || CLIP_DURATION_SEC
  );
  const negative_prompt =
    typeof extra.negative_prompt === "string"
      ? extra.negative_prompt
      : resolveNegativePrompt(opts.prompt);
  const restExtra = { ...extra };
  delete restExtra.negative_prompt;
  const input: Record<string, unknown> = {
    prompt,
    negative_prompt,
    ...restExtra,
  };
  if (opts.imageUrl) {
    input.image = opts.imageUrl;
    input.image_url = opts.imageUrl;
    input.start_image = opts.imageUrl;
    input.first_frame_image = opts.imageUrl;
  }
  if (!input.duration && !input.num_frames) {
    input.duration = seconds;
  }
  return input;
}

async function generateKlingVideo(
  opts: VideoOpts,
  version: "v2.5" | "v3"
): Promise<{ url: string; provider: "replicate"; model: string }> {
  const model =
    version === "v3" ? REPLICATE_MODELS.kling3 : REPLICATE_MODELS.kling25;
  requireReplicateClient();

  const url = await runModel(
    model,
    videoInput(opts, {
      cfg_scale: 0.5,
      aspect_ratio:
        opts.aspect === "9:16"
          ? "9:16"
          : opts.aspect === "1:1"
            ? "1:1"
            : "16:9",
    })
  );
  return { url, provider: "replicate", model };
}

async function generateLumaRay2Video(
  opts: VideoOpts
): Promise<{ url: string; provider: "replicate"; model: string }> {
  const model = REPLICATE_MODELS.lumaRay2;
  requireReplicateClient();

  const url = await runModel(
    model,
    videoInput(opts, {
      aspect_ratio:
        opts.aspect === "9:16"
          ? "9:16"
          : opts.aspect === "1:1"
            ? "1:1"
            : "16:9",
    })
  );
  return { url, provider: "replicate", model };
}

export async function generateWanVideo(
  opts: VideoOpts
): Promise<{ url: string; provider: "replicate"; model: string }> {
  const model = REPLICATE_MODELS.wan;
  const seconds = Math.min(
    CLIP_DURATION_SEC,
    opts.durationSec || CLIP_DURATION_SEC
  );
  requireReplicateClient();

  const url = await runModel(
    model,
    videoInput(opts, {
      num_frames: Math.round(seconds * 16),
      frames_per_second: 16,
      aspect_ratio: "16:9",
    })
  );
  return { url, provider: "replicate", model };
}

export async function generateMiniMaxVideo(
  opts: VideoOpts
): Promise<{ url: string; provider: "replicate"; model: string }> {
  const model = REPLICATE_MODELS.minimax;
  requireReplicateClient();

  const url = await runModel(
    model,
    videoInput(opts, { prompt_optimizer: true })
  );
  return { url, provider: "replicate", model };
}

/**
 * Unified video dispatch by engine id — hammasi Replicate orqali
 */
export async function generateReplicateVideo(opts: {
  prompt: string;
  imageUrl?: string;
  cameraMove?: CameraMovement;
  engine?: VideoEngine | string;
  durationSec?: number;
  aspect?: "16:9" | "9:16" | "1:1";
}): Promise<{ url: string; provider: string; model: string; engineId: string }> {
  const engine = (opts.engine || "auto") as string;
  const base: VideoOpts = {
    prompt: opts.prompt,
    imageUrl: opts.imageUrl,
    cameraMove: opts.cameraMove,
    durationSec: opts.durationSec,
    aspect: opts.aspect,
  };

  /**
   * Cost protection: ONE provider API call per user generation.
   * Multi-engine fallback disabled by default (VIDEO_ALLOW_FALLBACK=1 to opt-in).
   */
  const allowFallback = process.env.VIDEO_ALLOW_FALLBACK === "1";

  type Step = {
    id: string;
    run: () => Promise<{ url: string; provider: string; model: string }>;
  };

  const primary = ((): Step => {
    switch (engine) {
      case "kling-v3":
        return { id: "kling-v3", run: () => generateKlingVideo(base, "v3") };
      case "luma-ray2":
        return { id: "luma-ray2", run: () => generateLumaRay2Video(base) };
      case "runway-gen3":
        return {
          id: "runway-gen3",
          run: async () => {
            const model = REPLICATE_MODELS.runway;
            requireReplicateClient();
            const url = await runModel(model, videoInput(base));
            return { url, provider: "replicate", model };
          },
        };
      case "minimax":
        return { id: "minimax", run: () => generateMiniMaxVideo(base) };
      case "wan-2.5":
        return { id: "wan-2.5", run: () => generateWanVideo(base) };
      case "kling-v2.5":
      case "auto":
      default:
        return {
          id: engine === "auto" ? "kling-v2.5" : "kling-v2.5",
          run: () => generateKlingVideo(base, "v2.5"),
        };
    }
  })();

  const chain: Step[] = [primary];
  if (allowFallback) {
    if (primary.id !== "luma-ray2") {
      chain.push({ id: "luma-ray2", run: () => generateLumaRay2Video(base) });
    }
    if (primary.id !== "wan-2.5") {
      chain.push({ id: "wan-2.5", run: () => generateWanVideo(base) });
    }
  }

  let lastError: unknown;
  for (const step of chain) {
    try {
      const r = await step.run();
      if (r.url) return { ...r, engineId: step.id };
    } catch (e) {
      lastError = e;
      console.warn(
        `[Alnabiy Replicate] ${step.id} failed`,
        e instanceof Error ? e.message : e
      );
      if (!allowFallback) break;
    }
  }

  /* Never charge a user for a placeholder — always propagate so callers fail + refund. */
  throw lastError instanceof Error
    ? lastError
    : new Error("Video engine failed");
}

/**
 * Unified image dispatch — FLUX.1 Pro / SD3.5 via Replicate
 */
export async function generateReplicateImage(opts: {
  prompt: string;
  aspect?: "16:9" | "9:16" | "1:1";
  engine?: ImageEngineId | string;
}): Promise<{ url: string; provider: string; model: string; engineId: string }> {
  const engine = opts.engine || "auto";

  if (engine === "sd3.5-large") {
    try {
      const r = await generateSd35Image(opts);
      return { ...r, engineId: "sd3.5-large" };
    } catch {
      const r = await generateFluxImage(opts);
      return { ...r, engineId: "flux-pro" };
    }
  }

  try {
    const r = await generateFluxImage(opts);
    return { ...r, engineId: "flux-pro" };
  } catch (primaryError) {
    try {
      const r = await generateSd35Image(opts);
      return { ...r, engineId: "sd3.5-large" };
    } catch {
      /* Never charge a user for a placeholder — propagate the original failure. */
      throw primaryError instanceof Error
        ? primaryError
        : new Error("Image engine failed");
    }
  }
}
