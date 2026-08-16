import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

type FfmpegCapability = {
  available: boolean;
  reason?: string;
};

let capabilityCheck: Promise<FfmpegCapability> | null = null;

const isProductionRuntime = () => process.env.NODE_ENV === "production";

/**
 * Production media processing must run only on a runtime explicitly provisioned
 * with FFmpeg. This prevents serverless instances from silently producing
 * incomplete or unplayable assets.
 */
export function isFfmpegFeatureEnabled(): boolean {
  return !isProductionRuntime() || process.env.ALNABIY_FFMPEG_ENABLED === "1";
}

export class FfmpegCapabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FfmpegCapabilityError";
  }
}

async function inspectFfmpeg(): Promise<FfmpegCapability> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", ["-hide_banner", "-encoders"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;

    const finish = (result: FfmpegCapability) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    proc.stdout?.on("data", (chunk) => {
      output += chunk.toString();
    });
    proc.stderr?.on("data", (chunk) => {
      output += chunk.toString();
    });
    proc.once("error", () =>
      finish({ available: false, reason: "FFmpeg binary is not available." })
    );
    proc.once("close", (code) => {
      if (code !== 0) {
        finish({ available: false, reason: "FFmpeg capability probe failed." });
        return;
      }

      const hasH264 = /\blibx264\b/i.test(output);
      const hasAac = /(?:^|\s)aac(?:\s|$)/im.test(output);
      finish(
        hasH264 && hasAac
          ? { available: true }
          : {
              available: false,
              reason:
                "FFmpeg must include the libx264 video and AAC audio encoders.",
            }
      );
    });
  });
}

async function getFfmpegCapability(): Promise<FfmpegCapability> {
  capabilityCheck ||= inspectFfmpeg();
  return capabilityCheck;
}

export async function isFfmpegAvailable(): Promise<boolean> {
  if (!isFfmpegFeatureEnabled()) return false;
  return (await getFfmpegCapability()).available;
}

export async function assertFfmpegAvailable(): Promise<void> {
  if (!isFfmpegFeatureEnabled()) {
    throw new FfmpegCapabilityError(
      "FFmpeg media processing is disabled for this production runtime."
    );
  }

  const capability = await getFfmpegCapability();
  if (!capability.available) {
    throw new FfmpegCapabilityError(
      capability.reason || "FFmpeg capability check failed."
    );
  }
}

export interface MergeClip {
  videoPath: string;
  audioPath?: string;
  duration: number;
}

/**
 * FFmpeg worker — barcha kliplarni bitta MP4 ga birlashtiradi
 * Tizimda `ffmpeg` CLI o'rnatilgan bo'lishi kerak
 */
export async function mergeClipsToMp4(
  clips: MergeClip[],
  outputPath: string
): Promise<string> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const workDir = path.join(path.dirname(outputPath), `work_${Date.now()}`);
  await fs.mkdir(workDir, { recursive: true });

  const segmentPaths: string[] = [];

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const seg = path.join(workDir, `seg_${String(i).padStart(3, "0")}.mp4`);

    if (clip.audioPath) {
      await runFfmpeg([
        "-y",
        "-i",
        clip.videoPath,
        "-i",
        clip.audioPath,
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-shortest",
        "-pix_fmt",
        "yuv420p",
        seg,
      ]);
    } else {
      await runFfmpeg([
        "-y",
        "-i",
        clip.videoPath,
        "-c:v",
        "libx264",
        "-an",
        "-pix_fmt",
        "yuv420p",
        seg,
      ]);
    }
    segmentPaths.push(seg);
  }

  const listFile = path.join(workDir, "list.txt");
  await fs.writeFile(
    listFile,
    segmentPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n")
  );

  await runFfmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFile,
    "-c",
    "copy",
    outputPath,
  ]);

  return outputPath;
}

export async function runFfmpeg(args: string[]): Promise<void> {
  await assertFfmpegAvailable();
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", (err) => {
      reject(err);
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/**
 * Script-to-Movie pipeline orchestrator
 */
export async function runMoviePipeline(opts: {
  jobId: string;
  scenes: Array<{
    index: number;
    visual_prompt: string;
    voice_text: string;
    camera_movement: string;
    duration: number;
    videoUrl?: string;
    audioPath?: string;
  }>;
}): Promise<string> {
  const storage = process.env.STORAGE_DIR || "./storage";
  const jobDir = path.join(storage, "jobs", opts.jobId);
  await fs.mkdir(jobDir, { recursive: true });

  const clips: MergeClip[] = [];

  for (const scene of opts.scenes) {
    const videoPath = path.join(jobDir, `v_${scene.index}.mp4`);
    const audioPath = path.join(jobDir, `a_${scene.index}.mp3`);

    // Production: URL dan fayl yuklab olish
    if (scene.videoUrl?.startsWith("http")) {
      await downloadFile(scene.videoUrl, videoPath);
    } else {
      await fs.writeFile(videoPath, Buffer.alloc(0));
    }

    clips.push({
      videoPath,
      audioPath: scene.audioPath || audioPath,
      duration: scene.duration,
    });
  }

  const out = path.join(jobDir, "final.mp4");
  await mergeClipsToMp4(clips, out);
  return out;
}

export async function downloadFile(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
}

/**
 * Bitta 8s video + ElevenLabs audio → muxed MP4
 */
export async function muxVideoWithAudio(opts: {
  videoPathOrUrl: string;
  audioPath: string;
  outputPath: string;
  durationSec?: number;
}): Promise<string> {
  await fs.mkdir(path.dirname(opts.outputPath), { recursive: true });
  let videoPath = opts.videoPathOrUrl;

  if (opts.videoPathOrUrl.startsWith("http")) {
    videoPath = opts.outputPath.replace(/\.mp4$/i, "_src.mp4");
    await downloadFile(opts.videoPathOrUrl, videoPath);
  }

  const dur = opts.durationSec || 8;
  await runFfmpeg([
    "-y",
    "-i",
    videoPath,
    "-i",
    opts.audioPath,
    "-t",
    String(dur),
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-shortest",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    opts.outputPath,
  ]);

  return opts.outputPath;
}
