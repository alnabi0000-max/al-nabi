/**
 * Al-Nabi Audio Engine — Foley / micro SFX (ElevenLabs sound-generation, white-label).
 */

import fs from "fs/promises";
import path from "path";
import {
  getOpenRouterApiKey,
  getWatcherModel,
  openRouterChat,
} from "@/lib/ai/openrouter";
import { runFfmpeg } from "@/lib/ffmpeg-worker";

export type FoleyCue = {
  id: string;
  label: string;
  /** Plain description for sound generation */
  description: string;
  startMs: number;
  durationMs: number;
};

export type FoleyClip = FoleyCue & {
  audioPath: string;
  mock: boolean;
};

function elevenKey(): string | null {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key || key.includes("...")) return null;
  return key;
}

/**
 * Detect micro-actions from scene script / production brief → timed Foley cues.
 */
export async function detectFoleyCues(opts: {
  sceneText: string;
  durationSec: number;
}): Promise<FoleyCue[]> {
  const durationMs = Math.max(3000, opts.durationSec * 1000);
  const fallback: FoleyCue[] = [
    {
      id: "amb_1",
      label: "soft ambience",
      description: "subtle room tone ambience, quiet, clean",
      startMs: 200,
      durationMs: Math.min(2500, durationMs - 400),
    },
  ];

  if (!getOpenRouterApiKey()) return fallback;

  try {
    const raw = await openRouterChat({
      model: getWatcherModel(),
      json: true,
      temperature: 0.3,
      timeoutMs: 20_000,
      messages: [
        {
          role: "system",
          content: `You are Al-Nabi Audio Engine Foley planner.
Detect micro-actions that need sound effects (mouse click, lighter flick, page turn, footsteps, cup on table, door, whoosh, cloth rustle).
Return JSON: {"cues":[{"label":"short","description":"SFX prompt","startMs":0,"durationMs":400}]}
Max 6 cues. startMs within 0..${durationMs - 200}. durationMs 120..1800.
Never mention external vendors.`,
        },
        {
          role: "user",
          content: opts.sceneText.slice(0, 2500),
        },
      ],
    });
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as {
      cues?: Array<{
        label?: string;
        description?: string;
        startMs?: number;
        durationMs?: number;
      }>;
    };
    /** Snap to 24fps frame boundaries for frame-accurate mix */
    const FRAME_MS = 1000 / 24;
    const snap = (ms: number) => Math.round(ms / FRAME_MS) * FRAME_MS;
    const cues = (parsed.cues || [])
      .slice(0, 6)
      .map((c, i) => {
        const start = snap(
          Math.max(0, Math.min(durationMs - 150, c.startMs ?? i * 800))
        );
        const dur = snap(
          Math.max(120, Math.min(1800, c.durationMs ?? 400))
        );
        return {
          id: `foley_${i}`,
          label: c.label || `sfx_${i}`,
          description: c.description || c.label || "soft foley tap",
          startMs: start,
          durationMs: Math.max(FRAME_MS, dur),
        };
      });
    return cues.length ? cues : fallback;
  } catch {
    return fallback;
  }
}

async function writeSilenceWav(
  outPath: string,
  durationMs: number
): Promise<void> {
  // Minimal valid-ish WAV header + silence (mono 16-bit 22.05kHz)
  const sampleRate = 22050;
  const samples = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  await fs.writeFile(outPath, buffer);
}

async function generateProceduralFoley(
  outPath: string,
  durationMs: number,
  kind: string
): Promise<void> {
  const sec = Math.max(0.12, durationMs / 1000);
  const freq = /foot|step/i.test(kind)
    ? 90
    : /click|mouse|tap/i.test(kind)
      ? 1200
      : /whoosh|air/i.test(kind)
        ? 400
        : 220;

  try {
    await runFfmpeg([
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${freq}:duration=${sec}`,
      "-af",
      "afade=t=in:st=0:d=0.02,afade=t=out:st=" +
        Math.max(0.05, sec - 0.08) +
        `:d=0.08,volume=0.35`,
      outPath,
    ]);
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    try {
      await writeSilenceWav(outPath.replace(/\.mp3$/i, ".wav"), durationMs);
    } catch {
      /* development fallback */
    }
  }
}

/**
 * Generate one Foley clip via Al-Nabi Audio Engine (ElevenLabs sound-generation).
 */
export async function synthesizeFoleyClip(opts: {
  cue: FoleyCue;
  outDir: string;
}): Promise<FoleyClip> {
  await fs.mkdir(opts.outDir, { recursive: true });
  const outPath = path.join(opts.outDir, `${opts.cue.id}.mp3`);
  const key = elevenKey();

  if (key) {
    try {
      const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: opts.cue.description.slice(0, 400),
          duration_seconds: Math.min(
            22,
            Math.max(0.5, opts.cue.durationMs / 1000)
          ),
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 100) {
          await fs.writeFile(outPath, buf);
          return { ...opts.cue, audioPath: outPath, mock: false };
        }
      }
    } catch (e) {
      console.warn(
        "[Al-Nabi Audio] foley synth fallback",
        e instanceof Error ? e.message : e
      );
    }
  }

  await generateProceduralFoley(outPath, opts.cue.durationMs, opts.cue.label);
  const exists = await fs.stat(outPath).then(
    () => true,
    () => false
  );
  if (!exists) {
    const wav = outPath.replace(/\.mp3$/i, ".wav");
    await writeSilenceWav(wav, opts.cue.durationMs);
    return { ...opts.cue, audioPath: wav, mock: true };
  }
  return { ...opts.cue, audioPath: outPath, mock: true };
}

export async function buildFoleyBed(opts: {
  sceneText: string;
  durationSec: number;
  outDir: string;
}): Promise<FoleyClip[]> {
  const cues = await detectFoleyCues({
    sceneText: opts.sceneText,
    durationSec: opts.durationSec,
  });
  const clips: FoleyClip[] = [];
  for (const cue of cues) {
    clips.push(
      await synthesizeFoleyClip({
        cue,
        outDir: opts.outDir,
      })
    );
  }
  return clips;
}
