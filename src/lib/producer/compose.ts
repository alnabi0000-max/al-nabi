/**
 * Composite audio bed: voiceover + Foley (+ optional bed) → single track.
 * Al-Nabi Audio Engine — white-label.
 */

import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import type { FoleyClip } from "@/lib/producer/foley";

function runFfmpeg(args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Mix voiceover with timed Foley clips into one audio file.
 */
export async function mixVoiceAndFoley(opts: {
  voicePath: string;
  foley: FoleyClip[];
  outputPath: string;
  durationSec: number;
}): Promise<string> {
  await fs.mkdir(path.dirname(opts.outputPath), { recursive: true });

  if (!opts.foley.length) {
    await fs.copyFile(opts.voicePath, opts.outputPath);
    return opts.outputPath;
  }

  const inputs: string[] = ["-y", "-i", opts.voicePath];
  for (const f of opts.foley) {
    inputs.push("-i", f.audioPath);
  }

  // [0] voice; [1..] foley delayed
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
