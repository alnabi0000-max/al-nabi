/**
 * Alnabiy ElevenLabs Engine (v2 / v3)
 * Speech Synthesis · Voice Cloning · Emotion & Punctuation Parser
 * Natural prosody — detector-friendly human pacing (pauza, nafas, intonatsiya)
 */

import fs from "fs/promises";
import path from "path";
import type { EmotionMode } from "@/lib/credits";

const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

export type ElevenModel =
  | "eleven_multilingual_v2"
  | "eleven_turbo_v2_5"
  | "eleven_v3";

export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface AudioSynthResult {
  audioPath: string;
  audioBase64?: string;
  durationMs: number;
  words: WordTiming[];
  model: string;
  voiceId: string;
  mock: boolean;
  preparedText: string;
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

/** Emotsiya → ElevenLabs voice_settings */
export function emotionToVoiceSettings(
  emotion: EmotionMode = "neutral"
): VoiceSettings {
  const map: Record<EmotionMode, VoiceSettings> = {
    neutral: {
      stability: 0.52,
      similarity_boost: 0.78,
      style: 0.15,
      use_speaker_boost: true,
    },
    joy: {
      stability: 0.38,
      similarity_boost: 0.82,
      style: 0.55,
      use_speaker_boost: true,
    },
    drama: {
      stability: 0.48,
      similarity_boost: 0.85,
      style: 0.45,
      use_speaker_boost: true,
    },
    epic: {
      stability: 0.42,
      similarity_boost: 0.88,
      style: 0.6,
      use_speaker_boost: true,
    },
    calm: {
      stability: 0.72,
      similarity_boost: 0.7,
      style: 0.08,
      use_speaker_boost: true,
    },
    inspiring: {
      stability: 0.45,
      similarity_boost: 0.84,
      style: 0.5,
      use_speaker_boost: true,
    },
  };
  return map[emotion] || map.neutral;
}

/**
 * Dynamic Emotion & Punctuation Parser
 * Nuqta/vergul/undov/so'roq → pauza, nafas, intonatsiya belgilari
 */
export function prepareSpeechText(
  raw: string,
  emotion: EmotionMode = "neutral"
): string {
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return text;

  // Emotsiya prefiksi (model kontekstiga yumshoq ta'sir)
  const moodHint: Record<EmotionMode, string> = {
    neutral: "",
    joy: "[warm smile] ",
    drama: "[intense, measured] ",
    epic: "[powerful, cinematic] ",
    calm: "[soft, gentle] ",
    inspiring: "[uplifting, clear] ",
  };
  text = moodHint[emotion] + text;

  // Tinish belgilari → SSML-like break + nafas
  text = text
    .replace(/([.!?])\s+/g, "$1 <break time=\"0.45s\" /> ")
    .replace(/([,;:])\s+/g, "$1 <break time=\"0.18s\" /> ")
    .replace(/\?\s*<break/g, '? <break time="0.35s" /> <break')
    .replace(/!\s*<break/g, '! <break time="0.4s" /> <break')
    .replace(/\.\.\./g, ' <break time="0.55s" /> ')
    .replace(/—/g, ' <break time="0.25s" /> ')
    .replace(/–/g, ' <break time="0.22s" /> ');

  // Gaplar orxasidagi yumshoq nafas (uzun matn)
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length > 2) {
    text = sentences
      .map((s, i) =>
        i > 0 && i % 2 === 0 ? `<break time="0.12s" /> ${s}` : s
      )
      .join(" ");
  }

  // Juda qisqa so'zlardan keyin mikro-pauza (inson tempi)
  text = text.replace(
    /\b(and|but|so|then|va|lekin|ammo|а|но|и)\b\s+/gi,
    "$1 <break time=\"0.08s\" /> "
  );

  return text.replace(/\s+/g, " ").trim();
}

function estimateDurationMs(text: string): number {
  const clean = text.replace(/<[^>]+>/g, "").trim();
  const words = clean.split(/\s+/).filter(Boolean).length;
  // ~145 wpm inson tempi + pauzalar
  return Math.max(1200, Math.round((words / 145) * 60 * 1000 * 1.12));
}

function mockWordTimings(text: string): WordTiming[] {
  const clean = text.replace(/<[^>]+>/g, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  let t = 0;
  return words.map((word) => {
    const dur = Math.max(180, word.length * 55 + (word.match(/[.!?]$/) ? 220 : 0));
    const startMs = t;
    t += dur;
    return { word, startMs, endMs: t };
  });
}

function alignmentToWords(alignment: {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
}): WordTiming[] {
  const chars = alignment.characters || [];
  const starts = alignment.character_start_times_seconds || [];
  const ends = alignment.character_end_times_seconds || [];
  if (!chars.length) return [];

  const words: WordTiming[] = [];
  let buf = "";
  let wStart = 0;
  let wEnd = 0;
  let started = false;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const s = (starts[i] ?? 0) * 1000;
    const e = (ends[i] ?? starts[i] ?? 0) * 1000;
    if (/\s/.test(ch)) {
      if (buf) {
        words.push({ word: buf, startMs: Math.round(wStart), endMs: Math.round(wEnd) });
        buf = "";
        started = false;
      }
      continue;
    }
    if (!started) {
      wStart = s;
      started = true;
    }
    buf += ch;
    wEnd = e;
  }
  if (buf) {
    words.push({ word: buf, startMs: Math.round(wStart), endMs: Math.round(wEnd) });
  }
  return words;
}

function resolveModel(): ElevenModel {
  const m = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
  if (m === "eleven_v3" || m === "eleven_turbo_v2_5") return m;
  return "eleven_multilingual_v2";
}

/**
 * Speech Synthesis + with-timestamps (so'z taymerlari)
 */
export async function synthesizeSpeech(opts: {
  text: string;
  outPath: string;
  emotion?: EmotionMode;
  voiceId?: string;
  modelId?: ElevenModel;
  /** Voice clone ID (custom) */
  clonedVoiceId?: string;
}): Promise<AudioSynthResult> {
  await fs.mkdir(path.dirname(opts.outPath), { recursive: true });

  const emotion = opts.emotion || "neutral";
  const preparedText = prepareSpeechText(opts.text, emotion);
  const voiceId =
    opts.clonedVoiceId ||
    opts.voiceId ||
    process.env.ELEVENLABS_VOICE_ID ||
    "21m00Tcm4TlvDq8ikWAM";
  const model = opts.modelId || resolveModel();
  const key = process.env.ELEVENLABS_API_KEY;
  const settings = emotionToVoiceSettings(emotion);

  if (!key) {
    /* Never charge for a mock voiceover in production — AUTH_MODE alone must
     * not bypass this; only an explicit opt-in flag may. */
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALNABIY_ALLOW_AUDIO_MOCK !== "1"
    ) {
      throw new Error(
        "ELEVENLABS_API_KEY is required for voiceover in production"
      );
    }
    const words = mockWordTimings(preparedText);
    const durationMs = words.length
      ? words[words.length - 1].endMs
      : estimateDurationMs(preparedText);
    await fs.writeFile(
      opts.outPath.replace(/\.mp3$/i, ".json"),
      JSON.stringify(
        {
          mock: true,
          preparedText,
          emotion,
          words,
          durationMs,
          note: "Set ELEVENLABS_API_KEY for production audio",
        },
        null,
        2
      )
    );
    await fs.writeFile(opts.outPath, Buffer.alloc(0));
    return {
      audioPath: opts.outPath,
      durationMs,
      words,
      model,
      voiceId,
      mock: true,
      preparedText,
    };
  }

  // Prefer with-timestamps for director sync
  const url = `${ELEVEN_BASE}/text-to-speech/${voiceId}/with-timestamps`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      text: preparedText,
      model_id: model,
      voice_settings: settings,
    }),
  });

  if (!res.ok) {
    // Fallback: classic TTS without timestamps
    const fallback = await fetch(
      `${ELEVEN_BASE}/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: preparedText,
          model_id: model,
          voice_settings: settings,
        }),
      }
    );
    if (!fallback.ok) {
      throw new Error(`ElevenLabs error: ${res.status}/${fallback.status}`);
    }
    const buf = Buffer.from(await fallback.arrayBuffer());
    await fs.writeFile(opts.outPath, buf);
    const words = mockWordTimings(preparedText);
    const durationMs = estimateDurationMs(preparedText);
    return {
      audioPath: opts.outPath,
      audioBase64: buf.toString("base64"),
      durationMs,
      words,
      model,
      voiceId,
      mock: false,
      preparedText,
    };
  }

  const data = (await res.json()) as {
    audio_base64?: string;
    alignment?: {
      characters?: string[];
      character_start_times_seconds?: number[];
      character_end_times_seconds?: number[];
    };
  };

  const audioBase64 = data.audio_base64 || "";
  const buf = Buffer.from(audioBase64, "base64");
  await fs.writeFile(opts.outPath, buf);

  const words =
    data.alignment && data.alignment.characters?.length
      ? alignmentToWords(data.alignment)
      : mockWordTimings(preparedText);

  const durationMs = words.length
    ? words[words.length - 1].endMs
    : estimateDurationMs(preparedText);

  await fs.writeFile(
    opts.outPath.replace(/\.mp3$/i, ".align.json"),
    JSON.stringify({ words, durationMs, emotion, model, voiceId }, null, 2)
  );

  return {
    audioPath: opts.outPath,
    audioBase64,
    durationMs,
    words,
    model,
    voiceId,
    mock: false,
    preparedText,
  };
}

/**
 * Voice Cloning (Instant / Professional) — samples yuklash
 * Production: FormData + /v1/voices/add
 */
export async function cloneVoice(opts: {
  name: string;
  description?: string;
  samplePaths: string[];
}): Promise<{ voiceId: string; mock: boolean }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key || !opts.samplePaths.length) {
    return {
      voiceId: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
      mock: true,
    };
  }

  const form = new FormData();
  form.append("name", opts.name);
  if (opts.description) form.append("description", opts.description);
  form.append(
    "labels",
    JSON.stringify({ project: "Alnabiy", engine: "v2-v3" })
  );

  for (const p of opts.samplePaths) {
    const fileBuf = await fs.readFile(p);
    const bytes = new Uint8Array(fileBuf);
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    form.append("files", blob, path.basename(p));
  }

  const res = await fetch(`${ELEVEN_BASE}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": key },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs clone error: ${res.status}`);
  }
  const data = (await res.json()) as { voice_id?: string };
  return { voiceId: data.voice_id || "", mock: false };
}

/** In-memory buffer (API response uchun faylsiz) */
export async function synthesizeSpeechBuffer(opts: {
  text: string;
  emotion?: EmotionMode;
  voiceId?: string;
}): Promise<AudioSynthResult & { buffer: Buffer }> {
  const tmp = path.join(
    process.env.STORAGE_DIR || "./storage",
    "tmp",
    `voice_${Date.now()}.mp3`
  );
  const result = await synthesizeSpeech({ ...opts, outPath: tmp });
  let buffer = Buffer.alloc(0);
  try {
    buffer = await fs.readFile(tmp);
  } catch {
    /* empty mock */
  }
  return { ...result, buffer };
}
