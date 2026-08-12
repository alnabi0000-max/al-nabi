/**
 * Ambient BGM catalog + selection (server-only fs).
 * Tracks: public/music/{calm,epic,suspense,upbeat}/
 */

import fs from "fs/promises";
import path from "path";
import type { EmotionMode } from "@/lib/credits";
import {
  BGM_MOODS,
  type BgmMode,
  type BgmMood,
  type BgmTrackMeta,
} from "@/lib/bgm/types";

const AUDIO_EXT = new Set([".mp3", ".m4a", ".wav", ".ogg", ".aac"]);

const KEYWORDS: { mood: BgmMood; re: RegExp }[] = [
  {
    mood: "calm",
    re: /\b(calm|peaceful|soft|gentle|quiet|relax|serene|romantic|romance|romantik|love|nature|forest|ocean|tabiat|tinch|osoyishta|медленн|спокойн|тихо|нежн|романт|природ)\b/i,
  },
  {
    mood: "epic",
    re: /\b(epic|heroic|grand|cinematic|triumph|mighty|battle|war|fight|action|jangari|hayajon|ulug'|эпич|героич|величеств|боев|сражен)\b/i,
  },
  {
    mood: "suspense",
    re: /\b(suspense|tense|dark|thriller|mystery|horror|scary|dramatic|drama|jiddiy|qo'?rqinch|qo'rqinchli|напряж|драм|мрач|триллер|ужас)\b/i,
  },
  {
    mood: "upbeat",
    re: /\b(upbeat|joyful|happy|energetic|bright|fun|cheer|party|dance|quvnoq|shodon|весёл|радост|энергич)\b/i,
  },
];

function musicRoot(): string {
  return path.join(process.cwd(), "public", "music");
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function titleFromFilename(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function emotionToMood(emotion?: EmotionMode | null): BgmMood | null {
  switch (emotion) {
    case "calm":
      return "calm";
    case "epic":
      return "epic";
    case "drama":
      return "suspense";
    case "joy":
    case "inspiring":
      return "upbeat";
    case "neutral":
    default:
      return null;
  }
}

/**
 * Resolve mood from narration/emotion, visual DNA mood, and prompt keywords.
 * Defaults to epic when signals are weak.
 */
export function resolveBgmMood(opts: {
  brief?: string;
  narration?: EmotionMode | null;
  visualMood?: string | null;
}): BgmMood {
  const fromEmotion = emotionToMood(opts.narration);
  if (fromEmotion) return fromEmotion;

  const text = `${opts.visualMood || ""} ${opts.brief || ""}`.trim();
  if (text) {
    for (const { mood, re } of KEYWORDS) {
      if (re.test(text)) return mood;
    }
  }

  return "epic";
}

async function listAbsoluteInMood(mood: BgmMood): Promise<string[]> {
  const dir = path.join(musicRoot(), mood);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && AUDIO_EXT.has(path.extname(e.name).toLowerCase()))
      .map((e) => path.join(dir, e.name))
      .sort();
  } catch {
    return [];
  }
}

/** Public catalog for the track picker UI. */
export async function listAmbientTracks(): Promise<BgmTrackMeta[]> {
  const out: BgmTrackMeta[] = [];
  for (const mood of BGM_MOODS) {
    const files = await listAbsoluteInMood(mood);
    for (const abs of files) {
      const name = path.basename(abs);
      const id = `${mood}/${name}`;
      out.push({
        id,
        mood,
        title: titleFromFilename(name),
        url: `/music/${mood}/${encodeURIComponent(name)}`,
      });
    }
  }
  return out;
}

export async function resolveTrackById(
  trackId: string
): Promise<{ path: string; mood: BgmMood; trackId: string } | null> {
  const normalized = trackId.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/");
  if (parts.length !== 2) return null;
  const [moodRaw, fileName] = parts;
  if (!moodRaw || !fileName) return null;
  if (!BGM_MOODS.includes(moodRaw as BgmMood)) return null;
  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return null;
  }
  const mood = moodRaw as BgmMood;
  const abs = path.join(musicRoot(), mood, fileName);
  try {
    await fs.access(abs);
  } catch {
    return null;
  }
  return { path: abs, mood, trackId: `${mood}/${fileName}` };
}

/**
 * Pick one ambient track for the given mood.
 * Falls back across other mood folders if the preferred folder is empty.
 */
export async function pickAmbientTrack(opts: {
  mood?: BgmMood;
  seed?: string;
}): Promise<{ path: string; mood: BgmMood; trackId: string } | null> {
  const preferred = opts.mood || "epic";
  const order: BgmMood[] = [
    preferred,
    ...BGM_MOODS.filter((m) => m !== preferred),
  ];

  for (const mood of order) {
    const tracks = await listAbsoluteInMood(mood);
    if (!tracks.length) continue;
    const idx = opts.seed
      ? hashSeed(`${opts.seed}:${mood}`) % tracks.length
      : Math.floor(Math.random() * tracks.length);
    const abs = tracks[idx]!;
    const name = path.basename(abs);
    return { path: abs, mood, trackId: `${mood}/${name}` };
  }

  return null;
}

/**
 * Resolve final BGM file from UI mode + optional manual track id.
 * - off → null
 * - manual → trackId (falls back to AI if missing/invalid)
 * - ai → keyword/emotion mood pick
 */
export async function resolveBgmSelection(opts: {
  mode?: BgmMode | null;
  trackId?: string | null;
  prompt?: string;
  emotion?: EmotionMode | null;
  visualMood?: string | null;
  seed?: string;
}): Promise<{ path: string; mood: BgmMood; trackId: string } | null> {
  const mode: BgmMode = opts.mode || "ai";
  if (mode === "off") return null;

  if (mode === "manual" && opts.trackId?.trim()) {
    const byId = await resolveTrackById(opts.trackId.trim());
    if (byId) return byId;
  }

  if (mode === "manual" && !opts.trackId?.trim()) {
    return null;
  }

  const mood = resolveBgmMood({
    brief: opts.prompt,
    narration: opts.emotion,
    visualMood: opts.visualMood,
  });
  return pickAmbientTrack({ mood, seed: opts.seed });
}
