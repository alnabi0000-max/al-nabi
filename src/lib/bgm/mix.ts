/**
 * FFmpeg helpers: render a looped/faded BGM bed and mux onto video.
 */

import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { muxVideoWithAudio } from "@/lib/ffmpeg-worker";

/** Linear gain ≈ −20 dB so dialogue stays clear. */
export const BGM_LINEAR_VOLUME = 0.1;
const BGM_FADE_IN_SEC = 1.2;
const BGM_FADE_OUT_SEC = 1.5;

function runFfmpeg(args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/** Build a duration-matched ambient bed (loop + soft fades + duck). */
export async function renderAmbientBed(opts: {
  bgmPath: string;
  outputPath: string;
  durationSec: number;
  volume?: number;
}): Promise<string | null> {
  await fs.mkdir(path.dirname(opts.outputPath), { recursive: true });
  const dur = Math.max(1, opts.durationSec);
  const vol = opts.volume ?? BGM_LINEAR_VOLUME;
  const fadeOutStart = Math.max(0, dur - BGM_FADE_OUT_SEC);

  const ok = await runFfmpeg([
    "-y",
    "-stream_loop",
    "-1",
    "-i",
    opts.bgmPath,
    "-t",
    String(dur),
    "-af",
    `atrim=0:${dur},asetpts=PTS-STARTPTS,` +
      `afade=t=in:st=0:d=${BGM_FADE_IN_SEC},` +
      `afade=t=out:st=${fadeOutStart}:d=${BGM_FADE_OUT_SEC},` +
      `volume=${vol}`,
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    opts.outputPath,
  ]);

  if (!ok) return null;
  return opts.outputPath;
}

/**
 * Attach ambient BGM as the sole audio track on a (usually silent) video clip.
 * Used by Generate / StudioHub where there is no separate voiceover mix.
 */
export async function muxVideoWithAmbientBgm(opts: {
  videoPathOrUrl: string;
  bgmPath: string;
  outputPath: string;
  durationSec: number;
  workDir?: string;
}): Promise<string> {
  const dir = opts.workDir || path.dirname(opts.outputPath);
  await fs.mkdir(dir, { recursive: true });
  const bedPath = path.join(dir, `bgm_bed_${Date.now().toString(36)}.m4a`);
  const bed = await renderAmbientBed({
    bgmPath: opts.bgmPath,
    outputPath: bedPath,
    durationSec: opts.durationSec,
  });
  if (!bed) {
    // Fall through: copy/mux without bed is handled by caller via original URL
    throw new Error("BGM bed render failed");
  }
  try {
    return await muxVideoWithAudio({
      videoPathOrUrl: opts.videoPathOrUrl,
      audioPath: bed,
      outputPath: opts.outputPath,
      durationSec: opts.durationSec,
    });
  } finally {
    await fs.unlink(bedPath).catch(() => undefined);
  }
}
