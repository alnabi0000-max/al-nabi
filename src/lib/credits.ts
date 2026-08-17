/**
 * NC (Nabi Credits) — official financial standard:
 * 1 AI Image = 1 NC
 * 1 standard Prompt-to-Video clip (up to 15s flagship) = 20 NC
 * 1 minute Script-to-Movie = 40 NC
 */

import { STORAGE, WATERMARK_TEXT } from "@/lib/storage-keys";

export const BRAND = "Al-Nabi" as const;
export const WATERMARK = WATERMARK_TEXT;
/** Official in-app currency — Nabi Credits (see PLATFORM in lib/system/core) */
export const COIN_NAME = "NC" as const;
/** Cloud Vault archive re-download maintenance fee */
export const ARCHIVE_REDOWNLOAD_FEE_NC = 5;

/** USD equivalent for official packs ($20 → 2,000 base NC) */
export const USD_PER_COIN = 0.01;

/** Standard prompt-to-video clip — marketing + billing base (before multipliers). */
export const STANDARD_VIDEO_NC = 20;
/**
 * Display rate for 4K clip estimates on pricing / top-up.
 * Chosen so Starter (2,100 NC) shows ~105 standard / ~54 4K videos.
 */
export const ULTRA_4K_VIDEO_NC = 39;

export const PACK_PRICE_IDS = [
  "starter",
  "pro",
  "creator",
  "business",
  "studio",
] as const;

export type PackPriceId = (typeof PACK_PRICE_IDS)[number];

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
  prompt_to_video_per_min: STANDARD_VIDEO_NC,
  text_to_movie_per_min: 40,
} as const;

/**
 * Additive audio-clip NC (never folded into P2V/S2M minute rates).
 * Ambient BGM stays included in the video charge — local FFmpeg only.
 */
export const AUDIO_CREDIT_RATES = {
  ttsPerEightSec: 2,
  sfxPerClip: 1,
} as const;

export type AudioClipKind = "voice" | "sfx" | "bgm";

export type AudioCostClip = {
  kind: AudioClipKind;
  muted: boolean;
  /** Voice has narration, SFX has a prompt, BGM is on (not "off"). */
  hasContent: boolean;
  durationSec?: number;
};

/** ~150 wpm spoken estimate, capped for a single studio clip. */
export function estimateSpeechDurationSec(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.max(1, Math.min(30, Math.round((words / 2.5) * 10) / 10));
}

export function calculateTtsClipCost(durationSec: number): number {
  if (!(durationSec > 0)) return 0;
  const blocks = Math.max(1, Math.ceil(durationSec / 8));
  return blocks * AUDIO_CREDIT_RATES.ttsPerEightSec;
}

export function calculateSfxClipCost(active: boolean): number {
  return active ? AUDIO_CREDIT_RATES.sfxPerClip : 0;
}

/** Sum NC for unmuted audio clips with content. BGM is always 0. */
export function calculateActiveAudioCost(clips: AudioCostClip[]): number {
  let total = 0;
  for (const clip of clips) {
    if (clip.muted || !clip.hasContent || clip.kind === "bgm") continue;
    if (clip.kind === "sfx") {
      total += AUDIO_CREDIT_RATES.sfxPerClip;
      continue;
    }
    total += calculateTtsClipCost(clip.durationSec ?? 1);
  }
  return total;
}

export const CREDITS_PER_MINUTE = CREDIT_RATES.prompt_to_video_per_min;

/**
 * Single prompt-to-video clip billable ceiling (Kling 3.0 max = 15s).
 * MUST stay equal to CLIP_DURATION_SEC in lib/replicate.ts — P2V is billed
 * for the clip that can actually be rendered, not an arbitrary client duration.
 * text_to_movie is NOT capped here (scales to product max, e.g. 10 min).
 */
export const PROMPT_TO_VIDEO_CLIP_SEC = 15;

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
    case "auto":
    case "kling-v3":
      m *= 1.55;
      break;
    case "kling-v2.5":
      m *= 1.25;
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
    default:
      break;
  }
  switch (opts.quality) {
    case "720p":
      m *= 0.85;
      break;
    case "4K":
    case "8K":
      m *= 1.35;
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
  id: PackPriceId;
  name: string;
  priceUsd: number;
  coins: number;
  bonus: number;
  bonusPercent: number;
  tag: string;
  featured?: boolean;
  elite?: boolean;
}

/** Jami tangalar (asosiy + bonus) */
export function packTotalCoins(pack: Pick<CoinPack, "coins" | "bonus">): number {
  return pack.coins + pack.bonus;
}

/**
 * Package yield — 1 image = 1 NC · standard video = 20 NC · S2M = 40 NC/min
 */
export function packYield(pack: Pick<CoinPack, "coins" | "bonus">): {
  total: number;
  images: number;
  videoMinutes: number;
  movieMinutes: number;
  videoClips: number;
  standardVideos: number;
  ultra4kVideos: number;
} {
  const total = packTotalCoins(pack);
  const capacity = packVideoCapacity(total);
  return {
    total,
    images: total,
    videoMinutes: Math.floor(total / CREDIT_RATES.prompt_to_video_per_min),
    movieMinutes: Math.floor(total / CREDIT_RATES.text_to_movie_per_min),
    videoClips: capacity.standardVideos,
    standardVideos: capacity.standardVideos,
    ultra4kVideos: capacity.ultra4kVideos,
  };
}

/** Marketing capacity line: "~105 standard videos / ~54 4K videos". */
export function packVideoCapacity(totalNc: number): {
  standardVideos: number;
  ultra4kVideos: number;
} {
  const total = Math.max(0, totalNc);
  return {
    standardVideos: Math.round(total / STANDARD_VIDEO_NC),
    ultra4kVideos: Math.round(total / ULTRA_4K_VIDEO_NC),
  };
}

/**
 * Official NC packages ($20–$100). Checkout and /api/pricing must use these
 * exact USD amounts — geo-lock no longer changes the list price.
 */
export const COIN_PACKS: CoinPack[] = [
  {
    id: "starter",
    name: "Starter",
    priceUsd: 20,
    coins: 2000,
    bonus: 100,
    bonusPercent: 5,
    tag: "+5% Bonus",
  },
  {
    id: "pro",
    name: "Pro",
    priceUsd: 40,
    coins: 4000,
    bonus: 400,
    bonusPercent: 10,
    tag: "+10% Bonus",
    featured: true,
  },
  {
    id: "creator",
    name: "Yaratuvchi",
    priceUsd: 60,
    coins: 6000,
    bonus: 900,
    bonusPercent: 15,
    tag: "+15% Bonus",
    featured: true,
  },
  {
    id: "business",
    name: "Biznes",
    priceUsd: 80,
    coins: 8000,
    bonus: 1600,
    bonusPercent: 20,
    tag: "+20% Bonus",
    featured: true,
  },
  {
    id: "studio",
    name: "Studiya",
    priceUsd: 100,
    coins: 10000,
    bonus: 2500,
    bonusPercent: 25,
    tag: "+25% Bonus",
    elite: true,
  },
];

export function isPackPriceId(id: string): id is PackPriceId {
  return (PACK_PRICE_IDS as readonly string[]).includes(id);
}

export function getOfficialPack(id: string): CoinPack | undefined {
  return COIN_PACKS.find((pack) => pack.id === id);
}

export const REFERRAL_REWARD = 200;
export const DEMO_STARTING_CREDITS = 200;

export const LS_COINS = STORAGE.coins;
export const LS_KEY = STORAGE.key;
export const LS_STATUS = STORAGE.status;
export const LS_ATTEMPTS = STORAGE.attempts;
export const LS_LOCALE = STORAGE.locale;
export const LS_QUEUE = STORAGE.queue;
export const LS_HISTORY = STORAGE.history;
