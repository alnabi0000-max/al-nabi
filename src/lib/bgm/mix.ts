/**
 * FFmpeg helpers: render a looped/faded BGM bed and mux onto video.
 */

import fs from "fs/promises";
import path from "path";
import { muxVideoWithAudio, runFfmpeg } from "@/lib/ffmpeg-worker";

/** Linear gain ≈ −20 dB so dialogue stays clear. */
export const BGM_LINEAR_VOLUME = 0.1;
const BGM_FADE_IN_SEC = 1.2;
const BGM_FADE_OUT_SEC = 1.5;

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

  try {
    await runFfmpeg([
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
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    return null;
  }
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
