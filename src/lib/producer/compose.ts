/**
 * Composite audio bed: voiceover + Foley + optional ambient BGM → single track.
 * Al-Nabi Audio Engine — white-label.
 */

import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import type { FoleyClip } from "@/lib/producer/foley";

/** Linear gain ≈ −20 dB so VO stays dominant. */
const BGM_VOLUME = 0.1;
const BGM_FADE_IN_SEC = 1.2;
const BGM_FADE_OUT_SEC = 1.5;

function runFfmpeg(args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Mix voiceover with timed Foley clips and optional looping BGM into one audio file.
 * BGM is ducked under VO (~−20 dB), looped/trimmed to duration, with soft fade in/out.
 */
export async function mixVoiceAndFoley(opts: {
  voicePath: string;
  foley: FoleyClip[];
  outputPath: string;
  durationSec: number;
  /** Absolute path to ambient music; omitted → VO (+ Foley) only */
  bgmPath?: string | null;
}): Promise<string> {
  await fs.mkdir(path.dirname(opts.outputPath), { recursive: true });

  const hasFoley = opts.foley.length > 0;
  const hasBgm = Boolean(opts.bgmPath);

  if (!hasFoley && !hasBgm) {
    await fs.copyFile(opts.voicePath, opts.outputPath);
    return opts.outputPath;
  }

  const inputs: string[] = ["-y", "-i", opts.voicePath];
  for (const f of opts.foley) {
    inputs.push("-i", f.audioPath);
  }
  if (hasBgm && opts.bgmPath) {
    // Loop BGM so short tracks cover the full clip length
    inputs.push("-stream_loop", "-1", "-i", opts.bgmPath);
  }

  const filterParts: string[] = [];
  const mixLabels: string[] = ["[0:a]"];

  opts.foley.forEach((f, i) => {
    const idx = i + 1;
    const label = `f${i}`;
    filterParts.push(
      `[${idx}:a]adelay=${f.startMs}|${f.startMs},volume=0.55[${label}]`
    );
    mixLabels.push(`[${label}]`);
  });

  if (hasBgm) {
    const bgmIdx = 1 + opts.foley.length;
    const dur = Math.max(1, opts.durationSec);
    const fadeOutStart = Math.max(0, dur - BGM_FADE_OUT_SEC);
    filterParts.push(
      `[${bgmIdx}:a]atrim=0:${dur},asetpts=PTS-STARTPTS,` +
        `afade=t=in:st=0:d=${BGM_FADE_IN_SEC},` +
        `afade=t=out:st=${fadeOutStart}:d=${BGM_FADE_OUT_SEC},` +
        `volume=${BGM_VOLUME}[bgm]`
    );
    mixLabels.push("[bgm]");
  }

  const n = mixLabels.length;
  filterParts.push(
    `${mixLabels.join("")}amix=inputs=${n}:duration=longest:dropout_transition=0[aout]`
  );

  const ok = await runFfmpeg([
    ...inputs,
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    "[aout]",
    "-t",
    String(opts.durationSec),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    opts.outputPath,
  ]);

  if (!ok) {
    await fs.copyFile(opts.voicePath, opts.outputPath);
  }
  return opts.outputPath;
}

export async function ensureWorkDir(jobId: string): Promise<string> {
  const root = process.env.STORAGE_DIR || "./storage";
  const dir = path.join(root, "producer", jobId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
