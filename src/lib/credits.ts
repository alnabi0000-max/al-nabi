/**
 * NC (Nabi Credits) — tasdiqlangan moliyaviy standart:
 * 1 AI Rasm = 1 Tanga (~$0.05)
 * 1 daqiqa Prompt-to-Video = 30 Tanga (~$1.50)
 * 1 daqiqa Script-to-Movie = 40 Tanga (~$2.00)
 */

import { STORAGE, WATERMARK_TEXT } from "@/lib/storage-keys";

export const BRAND = "Al-Nabi" as const;
export const WATERMARK = WATERMARK_TEXT;
/** Official in-app currency — Nabi Credits (see PLATFORM in lib/system/core) */
export const COIN_NAME = "NC" as const;
/** Cloud Vault archive re-download maintenance fee */
export const ARCHIVE_REDOWNLOAD_FEE_NC = 5;

/** USD ekvivalent (ma'lumot uchun) */
export const USD_PER_COIN = 0.05;

export type StyleKey = "cinematic" | "cartoon" | "anime" | "realistic";

export type GenerationKind = "image" | "prompt_to_video" | "text_to_movie";

export type EmotionMode =
  | "neutral"
  | "joy"
  | "drama"
  | "epic"
  | "calm"
  | "inspiring";

export const EMOTION_MODES: { id: EmotionMode; label: string }[] = [
  { id: "neutral", label: "Neutral" },
  { id: "joy", label: "Joy" },
  { id: "drama", label: "Drama" },
  { id: "epic", label: "Epic" },
  { id: "calm", label: "Calm" },
  { id: "inspiring", label: "Inspiring" },
];

export const CREDIT_RATES = {
  image: 1,
  prompt_to_video_per_min: 30,
  text_to_movie_per_min: 40,
} as const;

export const CREDITS_PER_MINUTE = CREDIT_RATES.prompt_to_video_per_min;

/**
 * Single prompt-to-video clip billable ceiling.
 * MUST stay equal to CLIP_DURATION_SEC in lib/replicate.ts — P2V is billed
 * for the clip that can actually be rendered, not an arbitrary client duration.
 * text_to_movie is NOT capped here (scales to product max, e.g. 10 min).
 */
export const PROMPT_TO_VIDEO_CLIP_SEC = 8;

export function billableMinutes(durationSec: number): number {
  return Math.max(1, Math.ceil(Math.max(0, durationSec) / 60));
}

/**
 * Duration actually used for NC pricing (shared FE estimate + BE charge).
 * - image → 1s placeholder (flat 1 NC)
 * - prompt_to_video → min(requested, clip ceiling)
 * - text_to_movie → full requested seconds (proportional minutes)
 */
export function chargeableDurationSec(
  kind: GenerationKind,
  requestedSec: number,
  clipMaxSec: number = PROMPT_TO_VIDEO_CLIP_SEC
): number {
  if (kind === "image") return 1;
  const requested = Math.max(0, Number(requestedSec) || 0);
  if (kind === "prompt_to_video") {
    const ceiling = Math.max(1, clipMaxSec);
    return Math.min(ceiling, requested > 0 ? requested : ceiling);
  }
  return requested;
}

/** Exact insufficient-funds copy for API clients (required + available). */
export function formatInsufficientFundsMessage(
  requiredNc: number,
  availableNc: number
): string {
  return `Balansingiz yetarli emas, kerak: ${requiredNc} ${COIN_NAME}, sizda: ${availableNc} ${COIN_NAME}`;
}

/**
 * Find the longest duration (from candidates or minute steps) the user can
 * afford with `availableNc` under the shared pricing formula.
 */
export function suggestAffordableDurationSec(
  kind: GenerationKind,
  availableNc: number,
  opts?: CostOpts,
  candidates: number[] = [30, 60, 180, 300, 600]
): { durationSec: number; cost: number } | null {
  if (availableNc <= 0) return null;
  if (kind === "image") {
    const cost = calculateGenerationCost("image", 1, opts);
    return availableNc >= cost ? { durationSec: 1, cost } : null;
  }

  const sorted = [...new Set(candidates)]
    .filter((s) => s > 0)
    .sort((a, b) => b - a);

  for (const durationSec of sorted) {
    const cost = calculateGenerationCost(kind, durationSec, opts);
    if (cost <= availableNc) return { durationSec, cost };
  }

  /* Minute-step fallback for movie (down to 1 min). */
  if (kind === "text_to_movie") {
    for (let mins = Math.floor(availableNc / CREDIT_RATES.text_to_movie_per_min); mins >= 1; mins--) {
      const durationSec = mins * 60;
      const cost = calculateGenerationCost(kind, durationSec, opts);
      if (cost <= availableNc) return { durationSec, cost };
    }
  }

  return null;
}

export type CostOpts = {
  /** Official video/image engine id (kling-v3, flux-pro, …) */
  engine?: string | null;
  quality?: string | null;
  frameRate?: number | null;
  /** Override P2V clip ceiling (defaults to PROMPT_TO_VIDEO_CLIP_SEC) */
  clipMaxSec?: number | null;
};

function applyModelMultipliers(base: number, opts?: CostOpts): number {
  if (!opts) return Math.max(1, Math.round(base));
  // Lazy import avoided — multipliers inline to keep credits.ts lean
  let m = 1;
  switch (opts.engine) {
    case "kling-v2.5":
      m *= 1.25;
      break;
    case "kling-v3":
      m *= 1.55;
      break;
    case "luma-ray2":
      m *= 1.35;
      break;
    case "runway-gen3":
      m *= 1.45;
      break;
    case "sd3.5-large":
      m *= 1.1;
      break;
    case "flux-pro":
    case "wan-2.5":
    case "minimax":
    case "auto":
    default:
      break;
  }
  switch (opts.quality) {
    case "720p":
      m *= 0.85;
      break;
    case "4K":
      m *= 1.35;
      break;
    case "8K":
      m *= 1.75;
      break;
    default:
      break;
  }
  if (opts.frameRate === 60) m *= 1.25;
  else if (opts.frameRate === 30) m *= 1.05;
  return Math.max(1, Math.round(base * m));
}

export function calculateGenerationCost(
  kind: GenerationKind,
  durationSec = 60,
  opts?: CostOpts
): number {
  const billableSec = chargeableDurationSec(
    kind,
    durationSec,
    opts?.clipMaxSec ?? PROMPT_TO_VIDEO_CLIP_SEC
  );
  let base: number;
  if (kind === "image") {
    base = CREDIT_RATES.image;
  } else {
    const mins = billableMinutes(billableSec);
    base =
      kind === "prompt_to_video"
        ? mins * CREDIT_RATES.prompt_to_video_per_min
        : mins * CREDIT_RATES.text_to_movie_per_min;
  }
  return applyModelMultipliers(base, opts);
}

export function calculateCredits(
  durationSec: number,
  _style: StyleKey = "realistic"
): number {
  return calculateGenerationCost("prompt_to_video", durationSec);
}

export function calculateMovieCredits(
  durationSec: number,
  opts?: CostOpts
): number {
  return calculateGenerationCost("text_to_movie", durationSec, opts);
}

export function formatCredits(n: number): string {
  return `${n.toLocaleString("en-US")} ${COIN_NAME}`;
}

export interface CoinPack {
  id: string;
  name: string;
  priceUsd: number;
  coins: number;
  bonus: number;
  tag: string;
  featured?: boolean;
  elite?: boolean;
}

/** Jami tangalar (asosiy + bonus) */
export function packTotalCoins(pack: CoinPack): number {
  return pack.coins + pack.bonus;
}

/**
 * Paketdan taxminiy mahsulot hisobi
 * 1 rasm = 1 · P2V = 30/min · S2M = 40/min
 */
export function packYield(pack: CoinPack): {
  total: number;
  images: number;
  videoMinutes: number;
  movieMinutes: number;
} {
  const total = packTotalCoins(pack);
  return {
    total,
    images: total,
    videoMinutes: Math.floor(total / CREDIT_RATES.prompt_to_video_per_min),
    movieMinutes: Math.floor(total / CREDIT_RATES.text_to_movie_per_min),
  };
}

/**
 * Legacy pack metadata (coins/bonus).
 * Narxlar Strict Geo-Lock orqali `/api/pricing` dan keladi — bu yerda
 * priceUsd faqat fallback / demo; do'konda ko'rsatilmaydi.
 */
export const COIN_PACKS: CoinPack[] = [
  {
    id: "starter",
    name: "Starter Hook",
    priceUsd: 5,
    coins: 100,
    bonus: 0,
    tag: "Starter",
  },
  {
    id: "pro",
    name: "Pro Creator",
    priceUsd: 25,
    coins: 550,
    bonus: 50,
    tag: "+50 Bonus",
    featured: true,
  },
  {
    id: "hollywood",
    name: "Hollywood Studio",
    priceUsd: 50,
    coins: 1200,
    bonus: 200,
    tag: "+200 Bonus",
    featured: true,
  },
  {
    id: "director",
    name: "Director Choice",
    priceUsd: 80,
    coins: 2000,
    bonus: 400,
    tag: "+400 Bonus",
    featured: true,
  },
  {
    id: "infinite",
    name: "Infinite Al-Nabi",
    priceUsd: 100,
    coins: 2700,
    bonus: 700,
    tag: "+700 Bonus",
    elite: true,
  },
];

export const REFERRAL_REWARD = 200;
export const DEMO_STARTING_CREDITS = 200;

export const LS_COINS = STORAGE.coins;
export const LS_KEY = STORAGE.key;
export const LS_STATUS = STORAGE.status;
export const LS_ATTEMPTS = STORAGE.attempts;
export const LS_LOCALE = STORAGE.locale;
export const LS_QUEUE = STORAGE.queue;
export const LS_HISTORY = STORAGE.history;
