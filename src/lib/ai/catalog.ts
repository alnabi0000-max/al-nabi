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

export const RENDER_QUALITIES: RenderQuality[] = ["720p", "1080p", "4K", "8K"];
export const FRAME_RATES: FrameRate[] = [24, 30, 60];

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
    id: "kling-v2.5",
    media: "video",
    label: "Al-Nabi Cinematic",
    vendor: "Al-Nabi",
    description: "High-motion cinematic video",
    coinMultiplier: 1.25,
  },
  {
    id: "kling-v3",
    media: "video",
    label: "Al-Nabi Cinematic Pro",
    vendor: "Al-Nabi",
    description: "Flagship cinematic generation",
    coinMultiplier: 1.55,
  },
  {
    id: "luma-ray2",
    media: "video",
    label: "Al-Nabi Motion Pro",
    vendor: "Al-Nabi",
    description: "Fluid dreamlike motion",
    coinMultiplier: 1.35,
  },
  {
    id: "runway-gen3",
    media: "video",
    label: "Al-Nabi Motion Elite",
    vendor: "Al-Nabi",
    description: "Precision motion control",
    coinMultiplier: 1.45,
  },
  {
    id: "wan-2.5",
    media: "video",
    label: "Al-Nabi Stream",
    vendor: "Al-Nabi",
    description: "Fast gateway video route",
    coinMultiplier: 1.0,
  },
  {
    id: "minimax",
    media: "video",
    label: "Al-Nabi Pulse",
    vendor: "Al-Nabi",
    description: "Dynamic short-form motion",
    coinMultiplier: 1.0,
  },
  {
    id: "auto",
    media: "video",
    label: "Al-Nabi Auto",
    vendor: "Al-Nabi",
    description: "Smart best-available route",
    coinMultiplier: 1.0,
  },
];

export const IMAGE_MODEL_CARDS: OfficialModelCard[] = [
  {
    id: "flux-pro",
    media: "image",
    label: "Al-Nabi Realism",
    vendor: "Al-Nabi",
    description: "Photoreal still generation",
    coinMultiplier: 1.0,
  },
  {
    id: "sd3.5-large",
    media: "image",
    label: "Al-Nabi Realism Detail",
    vendor: "Al-Nabi",
    description: "High-detail still render",
    coinMultiplier: 1.1,
  },
  {
    id: "auto",
    media: "image",
    label: "Al-Nabi Realism Auto",
    vendor: "Al-Nabi",
    description: "Best available still route",
    coinMultiplier: 1.0,
  },
];

export const AUDIO_MODEL_CARD: OfficialModelCard = {
  id: "alnabi-voice",
  media: "audio",
  label: "Al-Nabi Voice",
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

export function videoEngineMultiplier(engine?: string | null): number {
  const card = VIDEO_MODEL_CARDS.find((c) => c.id === engine);
  return card?.coinMultiplier ?? 1;
}

export function imageEngineMultiplier(engine?: string | null): number {
  const card = IMAGE_MODEL_CARDS.find((c) => c.id === engine);
  return card?.coinMultiplier ?? 1;
}

export function qualityMultiplier(quality?: string | null): number {
  switch (quality) {
    case "720p":
      return 0.85;
    case "1080p":
      return 1;
    case "4K":
      return 1.35;
    case "8K":
      return 1.75;
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
  if (opts.quality) bits.push(`Target resolution: ${opts.quality}`);
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
