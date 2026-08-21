/**
 * Official top-tier AI model catalog — Alnabiy Neural Gateway
 */

import type { CameraMovement } from "@/lib/types";

/** Video engines (UI + API) */
export const VIDEO_ENGINES = [
  "kling-v2.5",
  "kling-v3",
  "luma-ray2",
  "runway-gen3",
  "wan-2.5",
  "minimax",
  "auto",
] as const;

export type VideoEngineId = (typeof VIDEO_ENGINES)[number];

/** Image engines */
export const IMAGE_ENGINES = ["flux-pro", "sd3.5-large", "auto"] as const;
export type ImageEngineId = (typeof IMAGE_ENGINES)[number];

export type RenderQuality = "720p" | "1080p" | "4K" | "8K";
export type FrameRate = 24 | 30 | 60;

/** API still accepts 8K (mapped to 4K). Studio never offers 8K. */
export const RENDER_QUALITIES: RenderQuality[] = ["720p", "1080p", "4K", "8K"];
export const PUBLIC_RENDER_QUALITIES: Exclude<RenderQuality, "8K">[] = [
  "720p",
  "1080p",
  "4K",
];
export const FRAME_RATES: FrameRate[] = [24, 30, 60];

/** Compact studio picker — simple outside, flagship inside. */
export const STUDIO_VIDEO_ENGINE_IDS: VideoEngineId[] = [
  "auto",
  "kling-v3",
  "kling-v2.5",
  "luma-ray2",
  "wan-2.5",
  "minimax",
];

export type ModelMedia = "video" | "image" | "audio";

export interface OfficialModelCard {
  id: VideoEngineId | ImageEngineId | "alnabi-voice" | "elevenlabs-tts";
  media: ModelMedia;
  /** UI da ko‘rinadigan rasmiy nom */
  label: string;
  vendor: string;
  description: string;
  /** Bazaviy tarifga ko‘paytiruvchi (coin) */
  coinMultiplier: number;
  /** Server-only hint — never expose vendor env names on client */
  envHint?: string;
}

export const VIDEO_MODEL_CARDS: OfficialModelCard[] = [
  {
    id: "auto",
    media: "video",
    label: "Auto",
    vendor: "Al-Nabi",
    description: "Capability-checked 15s Replicate route, up to 4K",
    coinMultiplier: 1.55,
  },
  {
    id: "kling-v3",
    media: "video",
    label: "Flagship",
    vendor: "Al-Nabi",
    description: "15s Replicate-hosted cinematic route with audio support",
    coinMultiplier: 1.55,
  },
  {
    id: "kling-v2.5",
    media: "video",
    label: "Cinematic",
    vendor: "Al-Nabi",
    description: "Replicate-hosted 10s high-motion cinematic route",
    coinMultiplier: 1.25,
  },
  {
    id: "runway-gen3",
    media: "video",
    label: "Runway direct (unconfigured)",
    vendor: "Unavailable",
    description: "Requires a configured direct Runway commercial adapter",
    coinMultiplier: 1.45,
  },
  {
    id: "luma-ray2",
    media: "video",
    label: "Motion Pro",
    vendor: "Al-Nabi",
    description: "Replicate-hosted motion route; input capabilities are checked",
    coinMultiplier: 1.35,
  },
  {
    id: "wan-2.5",
    media: "video",
    label: "Stream",
    vendor: "Al-Nabi",
    description: "Fast Replicate-hosted 5s text-only draft route",
    coinMultiplier: 1.0,
  },
  {
    id: "minimax",
    media: "video",
    label: "Pulse",
    vendor: "Al-Nabi",
    description: "Replicate-hosted short-form route (6–10s by resolution)",
    coinMultiplier: 1.0,
  },
];

export const IMAGE_MODEL_CARDS: OfficialModelCard[] = [
  {
    id: "flux-pro",
    media: "image",
    label: "Realism",
    vendor: "Al-Nabi",
    description: "Photoreal still generation",
    coinMultiplier: 1.0,
  },
  {
    id: "sd3.5-large",
    media: "image",
    label: "Realism Detail",
    vendor: "Al-Nabi",
    description: "High-detail still render",
    coinMultiplier: 1.1,
  },
  {
    id: "auto",
    media: "image",
    label: "Realism Auto",
    vendor: "Al-Nabi",
    description: "Best available still route",
    coinMultiplier: 1.0,
  },
];

export const AUDIO_MODEL_CARD: OfficialModelCard = {
  id: "alnabi-voice",
  media: "audio",
  label: "Voice",
  vendor: "Al-Nabi",
  description: "Studio-grade speech synthesis",
  coinMultiplier: 1.0,
};

export function isVideoEngineId(v: string): v is VideoEngineId {
  return (VIDEO_ENGINES as readonly string[]).includes(v);
}

export function isImageEngineId(v: string): v is ImageEngineId {
  return (IMAGE_ENGINES as readonly string[]).includes(v);
}

/** 8K is not delivered — coerce to 4K so billing and the provider stay honest. */
export function normalizeRenderQuality(
  quality?: string | null
): Exclude<RenderQuality, "8K"> {
  if (quality === "720p" || quality === "1080p" || quality === "4K") {
    return quality;
  }
  if (quality === "8K") return "4K";
  return "1080p";
}

/** Engines that emit dialogue / Foley in the video file itself. */
export function engineHasNativeAudio(engine?: string | null): boolean {
  return engine === "auto" || engine === "kling-v3";
}

export function videoEngineMultiplier(engine?: string | null): number {
  const card = VIDEO_MODEL_CARDS.find((c) => c.id === engine);
  return card?.coinMultiplier ?? 1;
}

export function imageEngineMultiplier(engine?: string | null): number {
  const card = IMAGE_MODEL_CARDS.find((c) => c.id === engine);
  return card?.coinMultiplier ?? 1;
}

export function qualityMultiplier(quality?: string | null): number {
  switch (normalizeRenderQuality(quality)) {
    case "720p":
      return 0.85;
    case "1080p":
      return 1;
    case "4K":
      return 1.35;
    default:
      return 1;
  }
}

export function frameRateMultiplier(fps?: number | null): number {
  if (fps === 60) return 1.25;
  if (fps === 30) return 1.05;
  return 1;
}

/** Promptga kamera / fps / sifat yo‘riqnomasi */
export function composeDirectorPrompt(
  prompt: string,
  opts: {
    cameraMove?: CameraMovement;
    quality?: RenderQuality;
    frameRate?: FrameRate;
  }
): string {
  const bits = [prompt];
  if (opts.cameraMove && opts.cameraMove !== "static") {
    bits.push(`Camera motion: ${opts.cameraMove.replace(/_/g, " ")}`);
  }
  const quality = normalizeRenderQuality(opts.quality);
  if (opts.quality) bits.push(`Target resolution: ${quality}`);
  if (opts.frameRate) bits.push(`Frame rate: ${opts.frameRate}fps`);
  return bits.join(". ");
}

/** Zod-friendly enums */
export const VIDEO_ENGINE_ZOD = VIDEO_ENGINES as unknown as [
  VideoEngineId,
  ...VideoEngineId[],
];
export const IMAGE_ENGINE_ZOD = IMAGE_ENGINES as unknown as [
  ImageEngineId,
  ...ImageEngineId[],
];
export const QUALITY_ZOD = RENDER_QUALITIES as unknown as [
  RenderQuality,
  ...RenderQuality[],
];
