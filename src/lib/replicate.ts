/**
 * Replicate Dispatcher — yagona Video & Image generation handler
 * Key: REPLICATE_API_KEY (legacy: REPLICATE_API_TOKEN)
 *
 * Upstream IDs stay server-only. Public UI is always Al-Nabi Native Engine.
 */

import Replicate from "replicate";
import type { CameraMovement } from "@/lib/types";
import { WATERMARK, PROMPT_TO_VIDEO_CLIP_SEC } from "@/lib/credits";
import type { ImageEngineId, RenderQuality, VideoEngineId } from "@/lib/ai/catalog";
import { normalizeRenderQuality } from "@/lib/ai/catalog";
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
  flux: "black-forest-labs/flux-2-pro",
  fluxLegacy: "black-forest-labs/flux-1.1-pro",
  sd35: "stability-ai/stable-diffusion-3.5-large",
  kling25: "kwaivgi/kling-v2.5-turbo-pro",
  kling3: "kwaivgi/kling-v3-video",
  lumaRay2: "luma/ray",
  runway: "kwaivgi/kling-v2.6",
  wan: "wan-video/wan-2.2-t2v-fast",
  minimax: "minimax/hailuo-02",
} as const;

export type ReplicateModelSlot =
  | "flux"
  | "sd35"
  | "kling25"
  | "kling3"
  | "lumaRay2"
  | "runway"
  | "wan"
  | "minimax";

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

function withNativeAudioHint(prompt: string): string {
  if (
    /says?\s+"|saying\s+"|dialogue|ambient sound|sound of|lip.?sync/i.test(
      prompt
    )
  ) {
    return prompt;
  }
  return `${prompt}. Natural scene audio: ambient atmosphere, realistic foley, no on-screen text.`;
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
const REPLICATE_VIDEO_TIMEOUT_MS = 360_000;

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

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function klingMode(quality?: string | null): "standard" | "pro" | "4k" {
  const q = normalizeRenderQuality(quality);
  if (q === "720p") return "standard";
  if (q === "4K") return "4k";
  return "pro";
}

function klingV3Duration(sec?: number): number {
  return clampInt(sec || CLIP_DURATION_SEC, 3, 15);
}

function klingFiveOrTen(sec?: number): number {
  return (sec || 10) <= 7 ? 5 : 10;
}

function aspectOf(opts: { aspect?: "16:9" | "9:16" | "1:1" }): "16:9" | "9:16" | "1:1" {
  return opts.aspect === "9:16" || opts.aspect === "1:1" ? opts.aspect : "16:9";
}

type VideoOpts = {
  prompt: string;
  imageUrl?: string;
  endImageUrl?: string;
  cameraMove?: CameraMovement;
  durationSec?: number;
  aspect?: "16:9" | "9:16" | "1:1";
  quality?: RenderQuality | string;
};

function basePrompt(opts: VideoOpts, nativeAudio: boolean): string {
  const prompted = withCamera(opts.prompt, opts.cameraMove);
  return nativeAudio ? withNativeAudioHint(prompted) : prompted;
}

function klingShared(opts: VideoOpts, nativeAudio: boolean): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: basePrompt(opts, nativeAudio),
    negative_prompt: resolveNegativePrompt(opts.prompt),
    aspect_ratio: aspectOf(opts),
  };
  if (opts.imageUrl) input.start_image = opts.imageUrl;
  if (opts.endImageUrl && opts.imageUrl) input.end_image = opts.endImageUrl;
  if (nativeAudio) input.generate_audio = true;
  return input;
}

/** FLUX.2 Pro still — no native negative_prompt. */
export async function generateFluxImage(opts: {
  prompt: string;
  aspect?: "16:9" | "9:16" | "1:1";
  quality?: RenderQuality | string;
  imageUrl?: string;
}): Promise<{ url: string; provider: "replicate"; model: string }> {
  requireReplicateClient();
  const aspectRatio =
    opts.aspect === "9:16" ? "9:16" : opts.aspect === "1:1" ? "1:1" : "16:9";
  const resolution = normalizeRenderQuality(opts.quality) === "4K" ? "2 MP" : "1 MP";
  const prompt = `${opts.prompt}. Ultra detailed, ${WATERMARK} quality still.`;
  const inputImages = opts.imageUrl ? [opts.imageUrl] : undefined;

  const tryFlux = async (model: string, extra: Record<string, unknown>) => {
    const url = await runModel(
      model,
      extra,
      REPLICATE_IMAGE_TIMEOUT_MS
    );
    return { url, provider: "replicate" as const, model };
  };

  try {
    return await tryFlux(REPLICATE_MODELS.flux, {
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      output_format: "png",
      safety_tolerance: 2,
      ...(inputImages ? { input_images: inputImages } : {}),
    });
  } catch (primary) {
    try {
      return await tryFlux(REPLICATE_MODEL_DEFAULTS.fluxLegacy, {
        prompt,
        aspect_ratio: aspectRatio,
        output_format: "png",
        safety_tolerance: 2,
      });
    } catch {
      throw primary instanceof Error ? primary : new Error("Image engine failed");
    }
  }
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

async function generateKlingVideo(
  opts: VideoOpts,
  version: "v2.5" | "v3" | "v2.6"
): Promise<{ url: string; provider: "replicate"; model: string }> {
  requireReplicateClient();
  const model =
    version === "v3"
      ? REPLICATE_MODELS.kling3
      : version === "v2.6"
        ? REPLICATE_MODELS.runway
        : REPLICATE_MODELS.kling25;

  const nativeAudio = version === "v3" || version === "v2.6";
  const input = klingShared(opts, nativeAudio);

  if (version === "v3") {
    input.duration = klingV3Duration(opts.durationSec);
    input.mode = klingMode(opts.quality);
  } else {
    input.duration = klingFiveOrTen(opts.durationSec);
  }

  const url = await runModel(model, input);
  return { url, provider: "replicate", model };
}

async function generateLumaRay2Video(
  opts: VideoOpts
): Promise<{ url: string; provider: "replicate"; model: string }> {
  const model = REPLICATE_MODELS.lumaRay2;
  requireReplicateClient();
  const input: Record<string, unknown> = {
    prompt: basePrompt(opts, false),
    aspect_ratio: aspectOf(opts),
    duration: klingFiveOrTen(opts.durationSec),
    negative_prompt: resolveNegativePrompt(opts.prompt),
  };
  if (opts.imageUrl) input.start_image = opts.imageUrl;
  const url = await runModel(model, input);
  return { url, provider: "replicate", model };
}

export async function generateWanVideo(
  opts: VideoOpts
): Promise<{ url: string; provider: "replicate"; model: string }> {
  const model = REPLICATE_MODELS.wan;
  requireReplicateClient();
  const url = await runModel(model, {
    prompt: basePrompt(opts, false),
    go_fast: true,
    num_frames: 81,
    frames_per_second: 16,
    interpolate_output: true,
    aspect_ratio: aspectOf(opts) === "1:1" ? "16:9" : aspectOf(opts),
    resolution: normalizeRenderQuality(opts.quality) === "720p" ? "480p" : "480p",
  });
  return { url, provider: "replicate", model };
}

export async function generateMiniMaxVideo(
  opts: VideoOpts
): Promise<{ url: string; provider: "replicate"; model: string }> {
  const model = REPLICATE_MODELS.minimax;
  requireReplicateClient();
  const quality = normalizeRenderQuality(opts.quality);
  const resolution = quality === "720p" ? "768p" : "1080p";
  const duration = resolution === "1080p" ? 6 : (opts.durationSec || 6) >= 9 ? 10 : 6;
  const input: Record<string, unknown> = {
    prompt: basePrompt(opts, false),
    prompt_optimizer: true,
    duration,
    resolution,
  };
  if (opts.imageUrl) input.first_frame_image = opts.imageUrl;
  if (opts.endImageUrl) input.last_frame_image = opts.endImageUrl;
  const url = await runModel(model, input);
  return { url, provider: "replicate", model };
}

/**
 * Unified video dispatch by engine id — hammasi Replicate orqali
 */
export async function generateReplicateVideo(opts: {
  prompt: string;
  imageUrl?: string;
  endImageUrl?: string;
  cameraMove?: CameraMovement;
  engine?: VideoEngine | string;
  durationSec?: number;
  aspect?: "16:9" | "9:16" | "1:1";
  quality?: RenderQuality | string;
}): Promise<{ url: string; provider: string; model: string; engineId: string }> {
  const engine = (opts.engine || "auto") as string;
  const base: VideoOpts = {
    prompt: opts.prompt,
    imageUrl: opts.imageUrl,
    endImageUrl: opts.endImageUrl,
    cameraMove: opts.cameraMove,
    durationSec: opts.durationSec,
    aspect: opts.aspect,
    quality: opts.quality,
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
      case "kling-v2.5":
        return { id: "kling-v2.5", run: () => generateKlingVideo(base, "v2.5") };
      case "luma-ray2":
        return { id: "luma-ray2", run: () => generateLumaRay2Video(base) };
      case "runway-gen3":
        return { id: "runway-gen3", run: () => generateKlingVideo(base, "v2.6") };
      case "minimax":
        return { id: "minimax", run: () => generateMiniMaxVideo(base) };
      case "wan-2.5":
        return { id: "wan-2.5", run: () => generateWanVideo(base) };
      case "kling-v3":
      case "auto":
      default:
        return {
          id: "kling-v3",
          run: () => generateKlingVideo(base, "v3"),
        };
    }
  })();

  const chain: Step[] = [primary];
  if (allowFallback) {
    if (primary.id !== "kling-v3") {
      chain.push({ id: "kling-v3", run: () => generateKlingVideo(base, "v3") });
    }
    if (primary.id !== "kling-v2.5") {
      chain.push({ id: "kling-v2.5", run: () => generateKlingVideo(base, "v2.5") });
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
 * Unified image dispatch — FLUX.2 Pro / SD3.5 via Replicate
 */
export async function generateReplicateImage(opts: {
  prompt: string;
  aspect?: "16:9" | "9:16" | "1:1";
  engine?: ImageEngineId | string;
  quality?: RenderQuality | string;
  imageUrl?: string;
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
