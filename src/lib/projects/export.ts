import { Prisma } from "@prisma/client";
import { z } from "zod";
import { calculateGenerationCost } from "@/lib/credits";
import { assertSufficientCoins } from "@/lib/ledger/atomic";
import { prisma } from "@/lib/prisma";
import { reserveProjectSpend, ProjectSpendCapError } from "@/lib/projects/spend";
import { isInngestConfigured, isProductionRuntime } from "@/lib/inngest/client";
import { isObjectStorageConfigured } from "@/lib/storage/object-storage";
import { resolvePrivateDeliveryUrl } from "@/lib/storage/signed-url";

const audioMixSchema = z
  .object({
    masterMuted: z.boolean().default(false),
    masterVolume: z.number().min(0).max(2).default(1),
    musicVolume: z.number().min(0).max(2).default(1),
    voiceVolume: z.number().min(0).max(2).default(1),
  })
  .strict()
  .default({
    masterMuted: false,
    masterVolume: 1,
    musicVolume: 1,
    voiceVolume: 1,
  });

export const exportRequestSchema = z.object({
  timelineRevision: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(16).max(160),
  format: z.literal("mp4").default("mp4"),
  quality: z.enum(["720p", "1080p", "4K"]).default("1080p"),
  frameRate: z.union([z.literal(24), z.literal(30), z.literal(60)]).default(24),
  audioMix: audioMixSchema.optional(),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;

export type TimelineExportSnapshot = {
  revision: number;
  fps: number;
  durationMs: number;
  audioMix: z.infer<typeof audioMixSchema>;
  tracks: Array<{
    id: string;
    kind: "VIDEO" | "AUDIO";
    name: string;
    position: number;
    muted: boolean;
    volume: number;
    clips: Array<{
      id: string;
      position: number;
      startMs: number;
      durationMs: number;
      trimStartMs: number;
      trimEndMs: number;
      muted: boolean;
      volume: number;
      source: {
        id: string;
        type: "asset" | "render_version";
        objectKey: string | null;
        label: string;
      };
    }>;
  }>;
};

export const timelineExportSnapshotSchema = z.object({
    revision: z.number().int().positive(),
    fps: z.union([z.literal(24), z.literal(30), z.literal(60)]),
    durationMs: z.number().int().nonnegative(),
    audioMix: audioMixSchema,
    tracks: z.array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(["VIDEO", "AUDIO"]),
        name: z.string().min(1),
        position: z.number().int().nonnegative(),
        muted: z.boolean(),
        volume: z.number().min(0).max(2),
        clips: z.array(
          z.object({
            id: z.string().min(1),
            position: z.number().int().nonnegative(),
            startMs: z.number().int().nonnegative(),
            durationMs: z.number().int().positive(),
            trimStartMs: z.number().int().nonnegative(),
            trimEndMs: z.number().int().nonnegative(),
            muted: z.boolean(),
            volume: z.number().min(0).max(2),
            source: z.object({
              id: z.string().min(1),
              type: z.enum(["asset", "render_version"]),
              objectKey: z.string().min(1).nullable(),
              label: z.string().min(1),
            }),
          })
        ),
      })
    ),
  });

export function parseTimelineExportSnapshot(value: unknown): TimelineExportSnapshot {
  return timelineExportSnapshotSchema.parse(value) as TimelineExportSnapshot;
}

export class ProjectExportError extends Error {
  constructor(
    public readonly code:
      | "EXPORT_TIMELINE_STALE"
      | "EXPORT_TIMELINE_EMPTY"
      | "EXPORT_SOURCE_UNAVAILABLE"
      | "EXPORT_UNSUPPORTED_TIMELINE"
      | "IDEMPOTENCY_KEY_REUSED"
      | "PROJECT_SPEND_CAP"
      | "PROJECT_NOT_FOUND",
    message: string
  ) {
    super(message);
    this.name = "ProjectExportError";
  }
}

export function exportConfigurationState(): {
  configured: boolean;
  reason: string | null;
} {
  if (process.env.ALNABIY_EXPORT_COMPOSITOR !== "ffmpeg") {
    return {
      configured: false,
      reason:
        "Cinematic export requires an explicitly configured FFmpeg media worker.",
    };
  }
  if (!isObjectStorageConfigured()) {
    return {
      configured: false,
      reason: "Cinematic export requires configured private object storage.",
    };
  }
  if (isProductionRuntime() && !isInngestConfigured()) {
    return {
      configured: false,
      reason: "Cinematic export requires configured production job delivery.",
    };
  }
  return { configured: true, reason: null };
}

/** A request never reports completion until a worker persists private output. */
export function initialExportStatus(
  configuration: { configured: boolean }
): "QUEUED" | "CONFIGURATION_REQUIRED" {
  return configuration.configured ? "QUEUED" : "CONFIGURATION_REQUIRED";
}

function exportIncludes() {
  return {
    timeline: {
      select: { id: true, revision: true, durationMs: true, fps: true },
    },
    generation: {
      select: { id: true, status: true, creditsCost: true },
    },
  } satisfies Prisma.ProjectExportInclude;
}

function snapshotFromTimeline(timeline: {
  revision: number;
  fps: number;
  durationMs: number;
  audioMix: Prisma.JsonValue;
  tracks: Array<{
    id: string;
    kind: "VIDEO" | "AUDIO";
    name: string;
    position: number;
    muted: boolean;
    volume: number;
    clips: Array<{
      id: string;
      position: number;
      startMs: number;
      durationMs: number;
      trimStartMs: number;
      trimEndMs: number;
      muted: boolean;
      volume: number;
      sourceAsset: {
        id: string;
        label: string;
        kind: string;
        r2Key: string | null;
      } | null;
      sourceRenderVersion: {
        id: string;
        number: number;
        status: string;
        outputR2Key: string | null;
      } | null;
    }>;
  }>;
}): TimelineExportSnapshot {
  const tracks = timeline.tracks.map((track) => ({
    id: track.id,
    kind: track.kind,
    name: track.name,
    position: track.position,
    muted: track.muted,
    volume: track.volume,
    clips: track.clips.map((clip) => {
      if (clip.sourceAsset) {
        return {
          id: clip.id,
          position: clip.position,
          startMs: clip.startMs,
          durationMs: clip.durationMs,
          trimStartMs: clip.trimStartMs,
          trimEndMs: clip.trimEndMs,
          muted: clip.muted,
          volume: clip.volume,
          source: {
            id: clip.sourceAsset.id,
            type: "asset" as const,
            objectKey: clip.sourceAsset.r2Key,
            label: clip.sourceAsset.label,
          },
        };
      }
      if (clip.sourceRenderVersion) {
        return {
          id: clip.id,
          position: clip.position,
          startMs: clip.startMs,
          durationMs: clip.durationMs,
          trimStartMs: clip.trimStartMs,
          trimEndMs: clip.trimEndMs,
          muted: clip.muted,
          volume: clip.volume,
          source: {
            id: clip.sourceRenderVersion.id,
            type: "render_version" as const,
            objectKey: clip.sourceRenderVersion.outputR2Key,
            label: `Render v${clip.sourceRenderVersion.number}`,
          },
        };
      }
      throw new ProjectExportError(
        "EXPORT_SOURCE_UNAVAILABLE",
        "A timeline clip has no private source."
      );
    }),
  }));

  return {
    revision: timeline.revision,
    fps: timeline.fps,
    durationMs: timeline.durationMs,
    audioMix: audioMixSchema.parse(timeline.audioMix),
    tracks,
  };
}

export function validateExportSnapshot(
  snapshot: TimelineExportSnapshot,
  requirePrivateSources = true
): void {
  const videoTracks = snapshot.tracks.filter(
    (track) => track.kind === "VIDEO" && track.clips.length > 0
  );
  if (videoTracks.length === 0) {
    throw new ProjectExportError(
      "EXPORT_TIMELINE_EMPTY",
      "Add at least one video clip before exporting."
    );
  }
  if (videoTracks.length > 1) {
    throw new ProjectExportError(
      "EXPORT_UNSUPPORTED_TIMELINE",
      "The configured compositor supports one populated video track per export."
    );
  }

  for (const track of snapshot.tracks) {
    for (const clip of track.clips) {
      if (requirePrivateSources && !clip.source.objectKey) {
        throw new ProjectExportError(
          "EXPORT_SOURCE_UNAVAILABLE",
          "Every export source must be stored as private project media."
        );
      }
    }
  }
}

const timelineForExportInclude = {
  tracks: {
    orderBy: { position: "asc" as const },
    include: {
      clips: {
        orderBy: [{ startMs: "asc" as const }, { position: "asc" as const }],
        include: {
          sourceAsset: {
            select: { id: true, label: true, kind: true, r2Key: true },
          },
          sourceRenderVersion: {
            select: {
              id: true,
              number: true,
              status: true,
              outputR2Key: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ProjectTimelineInclude;

export async function requestProjectExport(input: {
  projectId: string;
  userId: string;
  request: ExportRequest;
}) {
  const configuration = exportConfigurationState();

  return prisma.$transaction(
    async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: input.projectId, userId: input.userId },
        select: { id: true },
      });
      if (!project) throw new ProjectExportError("PROJECT_NOT_FOUND", "Project not found.");

      const existing = await tx.projectExport.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey: input.request.idempotencyKey,
          },
        },
        include: exportIncludes(),
      });
      if (existing) {
        if (existing.projectId !== project.id) {
          throw new ProjectExportError(
            "IDEMPOTENCY_KEY_REUSED",
            "Idempotency key was already used for a different project."
          );
        }
        return { projectExport: existing, created: false, configuration };
      }

      const timeline = await tx.projectTimeline.findUnique({
        where: { projectId: project.id },
        include: timelineForExportInclude,
      });
      if (!timeline || timeline.revision !== input.request.timelineRevision) {
        throw new ProjectExportError(
          "EXPORT_TIMELINE_STALE",
          "Timeline changed. Refresh it before requesting an export."
        );
      }
      const snapshot = snapshotFromTimeline(timeline);
      validateExportSnapshot(snapshot, configuration.configured);
      const audioMix = input.request.audioMix || snapshot.audioMix;

      if (initialExportStatus(configuration) === "CONFIGURATION_REQUIRED") {
        const projectExport = await tx.projectExport.create({
          data: {
            projectId: project.id,
            userId: input.userId,
            timelineId: timeline.id,
            timelineRevision: timeline.revision,
            idempotencyKey: input.request.idempotencyKey,
            status: "CONFIGURATION_REQUIRED",
            format: input.request.format,
            quality: input.request.quality,
            frameRate: input.request.frameRate,
            audioMix,
            timelineSnapshot: snapshot,
            errorCode: "EXPORT_PIPELINE_UNCONFIGURED",
            errorMessage: configuration.reason,
          },
          include: exportIncludes(),
        });
        return { projectExport, created: true, configuration };
      }

      const durationSec = Math.max(1, Math.ceil(snapshot.durationMs / 1000));
      const preflight = await assertSufficientCoins({
        userId: input.userId,
        kind: "text_to_movie",
        durationSec,
        costOpts: {
          quality: input.request.quality,
          frameRate: input.request.frameRate,
        },
      });
      if (!preflight.ok) {
        throw new Error(`EXPORT_CREDIT_PREFLIGHT:${preflight.code}:${preflight.message}`);
      }
      await reserveProjectSpend(tx, {
        projectId: project.id,
        userId: input.userId,
        credits: preflight.cost,
      });
      const generation = await tx.generation.create({
        data: {
          userId: input.userId,
          projectId: project.id,
          type: "SCRIPT_TO_MOVIE",
          status: "QUEUED",
          prompt: "Project timeline cinematic export",
          quality: input.request.quality,
          durationSec,
          reservedCredits: preflight.cost,
          scenesJson: {
            export: true,
            timelineRevision: timeline.revision,
            frameRate: input.request.frameRate,
          },
        },
        select: { id: true },
      });
      const projectExport = await tx.projectExport.create({
        data: {
          projectId: project.id,
          userId: input.userId,
          timelineId: timeline.id,
          timelineRevision: timeline.revision,
          generationId: generation.id,
          idempotencyKey: input.request.idempotencyKey,
          status: "QUEUED",
          format: input.request.format,
          quality: input.request.quality,
          frameRate: input.request.frameRate,
          audioMix,
          timelineSnapshot: snapshot,
        },
        include: exportIncludes(),
      });
      return { projectExport, created: true, configuration };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function findOwnedProjectExport(input: {
  projectId: string;
  exportId: string;
  userId: string;
}) {
  return prisma.projectExport.findFirst({
    where: {
      id: input.exportId,
      projectId: input.projectId,
      userId: input.userId,
    },
    include: exportIncludes(),
  });
}

export async function presentProjectExport(projectExport: {
  id: string;
  status: string;
  format: string;
  quality: string;
  frameRate: number;
  timelineRevision: number;
  outputR2Key: string | null;
  outputUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  generation: { id: string; status: string; creditsCost: number } | null;
}) {
  const deliveryUrl =
    projectExport.status === "COMPLETED"
      ? await resolvePrivateDeliveryUrl({
          objectKey: projectExport.outputR2Key,
          resultUrl: projectExport.outputUrl,
        })
      : null;
  return {
    id: projectExport.id,
    status: projectExport.status,
    format: projectExport.format,
    quality: projectExport.quality,
    frameRate: projectExport.frameRate,
    timelineRevision: projectExport.timelineRevision,
    deliveryUrl,
    errorCode: projectExport.errorCode,
    errorMessage: projectExport.errorMessage,
    createdAt: projectExport.createdAt,
    updatedAt: projectExport.updatedAt,
    completedAt: projectExport.completedAt,
    creditsCost: projectExport.generation?.creditsCost || 0,
  };
}

export function isProjectSpendCapError(error: unknown): boolean {
  return error instanceof ProjectSpendCapError;
}
