import path from "path";
import { access, mkdir } from "fs/promises";
import { pathToFileURL } from "url";
import { prisma } from "@/lib/prisma";
import { atomicChargeCoins } from "@/lib/ledger/atomic";
import { failAndRefundGeneration } from "@/lib/generation/fail-and-refund";
import {
  exportConfigurationState,
  parseTimelineExportSnapshot,
  type TimelineExportSnapshot,
  validateExportSnapshot,
} from "@/lib/projects/export";
import { releaseProjectReservation } from "@/lib/projects/spend";
import {
  downloadFile,
  isFfmpegAvailable,
  mergeClipsToMp4,
  runFfmpeg,
} from "@/lib/ffmpeg-worker";
import { persistRemoteAsset } from "@/lib/storage/object-storage";
import {
  createSignedGetUrl,
  localStoredObjectPath,
} from "@/lib/storage/signed-url";

type ExportPayloadClip =
  TimelineExportSnapshot["tracks"][number]["clips"][number] & {
    sourceUrl: string;
  };

type ExportPayloadTrack = Omit<TimelineExportSnapshot["tracks"][number], "clips"> & {
  clips: ExportPayloadClip[];
};

type ExportPayload = {
  id: string;
  quality: "720p" | "1080p" | "4K";
  frameRate: 24 | 30 | 60;
  snapshot: TimelineExportSnapshot;
  tracks: ExportPayloadTrack[];
};

async function resolveExportSource(objectKey: string): Promise<string | null> {
  const signed = await createSignedGetUrl(objectKey, 15 * 60);
  if (signed) return signed;
  if (process.env.NODE_ENV === "production") return null;
  const localPath = localStoredObjectPath(objectKey);
  try {
    await access(localPath);
    return pathToFileURL(localPath).href;
  } catch {
    return null;
  }
}

const QUALITY_HEIGHT: Record<ExportPayload["quality"], number> = {
  "720p": 720,
  "1080p": 1080,
  "4K": 2160,
};
const QUALITY_WIDTH: Record<ExportPayload["quality"], number> = {
  "720p": 1280,
  "1080p": 1920,
  "4K": 3840,
};

function seconds(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(3);
}

async function buildExportPayload(input: {
  id: string;
  quality: string;
  frameRate: number;
  snapshot: unknown;
}): Promise<ExportPayload> {
  const snapshot = parseTimelineExportSnapshot(input.snapshot);
  validateExportSnapshot(snapshot, true);
  const quality =
    input.quality === "720p" || input.quality === "4K"
      ? input.quality
      : "1080p";
  const frameRate =
    input.frameRate === 30 || input.frameRate === 60 ? input.frameRate : 24;

  const tracks = await Promise.all(
    snapshot.tracks.map(async (track) => ({
      ...track,
      clips: await Promise.all(
        track.clips.map(async (clip) => {
          const sourceUrl = clip.source.objectKey
            ? await resolveExportSource(clip.source.objectKey)
            : null;
          if (!sourceUrl) {
            throw new Error("EXPORT_PRIVATE_SOURCE_UNAVAILABLE");
          }
          return { ...clip, sourceUrl };
        })
      ),
    }))
  );
  return { id: input.id, quality, frameRate, snapshot, tracks };
}

async function renderVideoSegments(
  payload: ExportPayload,
  workDir: string
): Promise<string> {
  const track = payload.tracks.find(
    (item) => item.kind === "VIDEO" && item.clips.length > 0
  );
  if (!track) throw new Error("EXPORT_VIDEO_TRACK_REQUIRED");
  const clips = [...track.clips].sort((a, b) => a.startMs - b.startMs);
  const segments: Array<{ videoPath: string; duration: number }> = [];
  let cursorMs = 0;

  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index];
    if (clip.startMs > cursorMs) {
      const gapMs = clip.startMs - cursorMs;
      const gapPath = path.join(workDir, `gap-${index}.mp4`);
      await runFfmpeg([
        "-y",
        "-f",
        "lavfi",
        "-i",
        `color=c=black:s=${QUALITY_WIDTH[payload.quality]}x${QUALITY_HEIGHT[payload.quality]}:r=${payload.frameRate}:d=${seconds(gapMs)}`,
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        gapPath,
      ]);
      segments.push({ videoPath: gapPath, duration: gapMs / 1000 });
    }

    const sourcePath = path.join(workDir, `video-source-${index}.mp4`);
    const segmentPath = path.join(workDir, `video-segment-${index}.mp4`);
    await downloadFile(clip.sourceUrl, sourcePath);
    await runFfmpeg([
      "-y",
      "-ss",
      seconds(clip.trimStartMs),
      "-i",
      sourcePath,
      "-t",
      seconds(clip.durationMs),
      "-an",
      "-vf",
      `scale=${QUALITY_WIDTH[payload.quality]}:${QUALITY_HEIGHT[payload.quality]}:force_original_aspect_ratio=decrease,pad=${QUALITY_WIDTH[payload.quality]}:${QUALITY_HEIGHT[payload.quality]}:(ow-iw)/2:(oh-ih)/2`,
      "-r",
      String(payload.frameRate),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      segmentPath,
    ]);
    segments.push({ videoPath: segmentPath, duration: clip.durationMs / 1000 });
    cursorMs = clip.startMs + clip.durationMs;
  }

  if (payload.snapshot.durationMs > cursorMs) {
    const gapMs = payload.snapshot.durationMs - cursorMs;
    const gapPath = path.join(workDir, "gap-final.mp4");
    await runFfmpeg([
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=black:s=${QUALITY_WIDTH[payload.quality]}x${QUALITY_HEIGHT[payload.quality]}:r=${payload.frameRate}:d=${seconds(gapMs)}`,
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      gapPath,
    ]);
    segments.push({ videoPath: gapPath, duration: gapMs / 1000 });
  }

  const basePath = path.join(workDir, "video-base.mp4");
  await mergeClipsToMp4(segments, basePath);
  return basePath;
}

async function mixTimelineAudio(
  payload: ExportPayload,
  videoPath: string,
  workDir: string
): Promise<string> {
  const mix = payload.snapshot.audioMix;
  const audioClips = payload.tracks
    .filter((track) => track.kind === "AUDIO" && !track.muted)
    .flatMap((track) =>
      track.clips
        .filter((clip) => !clip.muted)
        .map((clip) => ({ clip, track }))
    );
  if (mix.masterMuted || audioClips.length === 0) return videoPath;

  const inputs = ["-y", "-i", videoPath];
  const filters: string[] = [];
  for (let index = 0; index < audioClips.length; index += 1) {
    const { clip, track } = audioClips[index];
    const sourcePath = path.join(workDir, `audio-source-${index}.media`);
    await downloadFile(clip.sourceUrl, sourcePath);
    inputs.push("-ss", seconds(clip.trimStartMs), "-t", seconds(clip.durationMs), "-i", sourcePath);
    const gain = Math.max(0, Math.min(2, clip.volume * track.volume));
    filters.push(
      `[${index + 1}:a]atrim=duration=${seconds(clip.durationMs)},adelay=${clip.startMs}|${clip.startMs},volume=${gain}[a${index}]`
    );
  }
  const mixedInputs = audioClips.map((_, index) => `[a${index}]`).join("");
  filters.push(
    `${mixedInputs}amix=inputs=${audioClips.length}:duration=longest:dropout_transition=0,volume=${mix.masterVolume}[mixed]`
  );

  const outputPath = path.join(workDir, "final.mp4");
  await runFfmpeg([
    ...inputs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "0:v:0",
    "-map",
    "[mixed]",
    "-t",
    seconds(payload.snapshot.durationMs),
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
  return outputPath;
}

async function renderTimelineExport(payload: ExportPayload): Promise<string> {
  const root = process.env.STORAGE_DIR || "./storage";
  const workDir = path.join(root, "exports", payload.id);
  await mkdir(workDir, { recursive: true });
  const videoPath = await renderVideoSegments(payload, workDir);
  return mixTimelineAudio(payload, videoPath, workDir);
}

export async function processProjectExport(exportId: string): Promise<{
  ok: boolean;
  status: string;
}> {
  const claimed = await prisma.projectExport.updateMany({
    where: { id: exportId, status: "QUEUED" },
    data: { status: "PROCESSING", startedAt: new Date(), errorCode: null, errorMessage: null },
  });
  if (claimed.count !== 1) {
    const existing = await prisma.projectExport.findUnique({
      where: { id: exportId },
      select: { status: true },
    });
    return { ok: existing?.status === "COMPLETED", status: existing?.status || "MISSING" };
  }

  const projectExport = await prisma.projectExport.findUnique({
    where: { id: exportId },
    select: {
      id: true,
      userId: true,
      status: true,
      quality: true,
      frameRate: true,
      timelineSnapshot: true,
      generationId: true,
      generation: { select: { id: true, durationSec: true } },
    },
  });
  if (!projectExport?.generationId || !projectExport.generation) {
    await prisma.projectExport.updateMany({
      where: { id: exportId, status: "PROCESSING" },
      data: {
        status: "FAILED",
        errorCode: "EXPORT_GENERATION_MISSING",
        errorMessage: "Export billing record is missing.",
      },
    });
    return { ok: false, status: "FAILED" };
  }

  const configuration = exportConfigurationState();
  if (!configuration.configured || !(await isFfmpegAvailable())) {
    await failAndRefundGeneration({
      generationId: projectExport.generationId,
      error: configuration.reason || "FFmpeg worker capability is unavailable.",
      area: "project-export-configuration",
    });
    await prisma.projectExport.update({
      where: { id: exportId },
      data: {
        status: "CONFIGURATION_REQUIRED",
        errorCode: "EXPORT_PIPELINE_UNCONFIGURED",
        errorMessage:
          configuration.reason ||
          "Cinematic export requires an FFmpeg-capable media worker.",
      },
    });
    return { ok: false, status: "CONFIGURATION_REQUIRED" };
  }

  try {
    const charge = await atomicChargeCoins({
      userId: projectExport.userId,
      kind: "text_to_movie",
      durationSec: projectExport.generation.durationSec,
      generationId: projectExport.generationId,
      reason: "project:timeline_export",
      costOpts: {
        quality: projectExport.quality,
        frameRate: projectExport.frameRate,
      },
    });
    if (!charge.ok) {
      await failAndRefundGeneration({
        generationId: projectExport.generationId,
        error: charge.message,
        area: "project-export-charge",
      });
      await prisma.projectExport.update({
        where: { id: exportId },
        data: {
          status: "FAILED",
          errorCode: charge.code,
          errorMessage: charge.message,
        },
      });
      return { ok: false, status: "FAILED" };
    }

    await prisma.generation.update({
      where: { id: projectExport.generationId },
      data: { status: "MERGING", errorMessage: null },
    });
    const payload = await buildExportPayload({
      id: projectExport.id,
      quality: projectExport.quality,
      frameRate: projectExport.frameRate,
      snapshot: projectExport.timelineSnapshot,
    });
    const outputPath = await renderTimelineExport(payload);
    const stored = await persistRemoteAsset({
      sourceUrl: outputPath,
      userId: projectExport.userId,
      generationId: projectExport.id,
      kind: "video",
    });
    await prisma.$transaction([
      prisma.generation.update({
        where: { id: projectExport.generationId },
        data: {
          status: "COMPLETED",
          r2Key: stored.key,
          resultUrl: stored.url,
          provider: "Project timeline compositor",
          errorMessage: null,
        },
      }),
      prisma.projectExport.update({
        where: { id: exportId },
        data: {
          status: "COMPLETED",
          outputR2Key: stored.key,
          outputUrl: stored.url,
          errorCode: null,
          errorMessage: null,
          completedAt: new Date(),
          workerMetadata: {
            compositor: "ffmpeg",
            timelineRevision: payload.snapshot.revision,
            chargedNc: charge.cost,
          },
        },
      }),
    ]);
    return { ok: true, status: "COMPLETED" };
  } catch (error) {
    const refunded = await failAndRefundGeneration({
      generationId: projectExport.generationId,
      error,
      area: "project-export-render",
    });
    await prisma.projectExport.update({
      where: { id: exportId },
      data: {
        status: "FAILED",
        errorCode: "EXPORT_RENDER_FAILED",
        errorMessage: refunded.errorMessage,
      },
    });
    return { ok: false, status: "FAILED" };
  } finally {
    // A failed uncharged job might have been stopped before its worker reached
    // the common failure helper; releasing zero is idempotent.
    await releaseProjectReservation(projectExport.generationId).catch(() => {});
  }
}
