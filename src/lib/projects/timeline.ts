import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const trackKindSchema = z.enum(["VIDEO", "AUDIO"]);
const sourceIdSchema = z.string().trim().min(1).max(100);

const clipSchema = z
  .object({
    position: z.number().int().min(0).max(500),
    startMs: z.number().int().min(0).max(86_400_000),
    durationMs: z.number().int().min(100).max(86_400_000),
    trimStartMs: z.number().int().min(0).max(86_400_000).default(0),
    trimEndMs: z.number().int().min(0).max(86_400_000).default(0),
    muted: z.boolean().default(false),
    volume: z.number().min(0).max(2).default(1),
    sourceAssetId: sourceIdSchema.optional().nullable(),
    sourceRenderVersionId: sourceIdSchema.optional().nullable(),
    metadata: z
      .object({
        label: z.string().trim().max(120).optional(),
        transition: z.enum(["cut", "fade"]).optional(),
      })
      .strict()
      .optional()
      .nullable(),
  })
  .superRefine((clip, ctx) => {
    const sourceCount = Number(Boolean(clip.sourceAssetId)) +
      Number(Boolean(clip.sourceRenderVersionId));
    if (sourceCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each timeline clip must reference exactly one asset or render version.",
        path: ["sourceAssetId"],
      });
    }
    if (clip.trimStartMs + clip.trimEndMs >= clip.durationMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Timeline clip trims must leave playable media.",
        path: ["trimEndMs"],
      });
    }
  });

const trackSchema = z.object({
  position: z.number().int().min(0).max(20),
  kind: trackKindSchema,
  name: z.string().trim().min(1).max(80),
  muted: z.boolean().default(false),
  volume: z.number().min(0).max(2).default(1),
  clips: z.array(clipSchema).max(500).default([]),
});

export const timelineUpdateSchema = z.object({
  revision: z.number().int().positive(),
  fps: z.union([z.literal(24), z.literal(30), z.literal(60)]).default(24),
  audioMix: z
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
    }),
  tracks: z.array(trackSchema).min(1).max(21),
});

export type TimelineUpdate = z.infer<typeof timelineUpdateSchema>;

export class TimelineValidationError extends Error {
  constructor(
    public readonly code:
      | "TIMELINE_SOURCE_NOT_FOUND"
      | "TIMELINE_SOURCE_KIND_INVALID"
      | "TIMELINE_OVERLAP"
      | "TIMELINE_POSITIONS_INVALID",
    message: string
  ) {
    super(message);
    this.name = "TimelineValidationError";
  }
}

export class TimelineConflictError extends Error {
  constructor() {
    super("Timeline revision is stale. Refresh before saving.");
    this.name = "TimelineConflictError";
  }
}

export class TimelineNotFoundError extends Error {
  constructor() {
    super("Project timeline not found.");
    this.name = "TimelineNotFoundError";
  }
}

export function assertTimelinePositions(input: TimelineUpdate): void {
  const trackPositions = new Set<number>();
  for (const track of input.tracks) {
    if (trackPositions.has(track.position)) {
      throw new TimelineValidationError(
        "TIMELINE_POSITIONS_INVALID",
        "Timeline tracks must use unique positions."
      );
    }
    trackPositions.add(track.position);

    const clipPositions = new Set<number>();
    const ordered = [...track.clips].sort((a, b) => a.startMs - b.startMs);
    for (const clip of track.clips) {
      if (clipPositions.has(clip.position)) {
        throw new TimelineValidationError(
          "TIMELINE_POSITIONS_INVALID",
          "Timeline clips must use unique positions within a track."
        );
      }
      clipPositions.add(clip.position);
    }

    // The current compositor supports one sequential video source per video
    // track. Audio clips may overlap intentionally for a real mix.
    if (track.kind === "VIDEO") {
      for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1];
        const current = ordered[index];
        if (previous.startMs + previous.durationMs > current.startMs) {
          throw new TimelineValidationError(
            "TIMELINE_OVERLAP",
            "Video clips may not overlap on the same track."
          );
        }
      }
    }
  }
}

export function assertTimelineSourceOwnership(
  input: TimelineUpdate,
  sources: {
    assets: Array<{ id: string; kind: string }>;
    renderVersions: Array<{ id: string }>;
  }
): void {
  const assets = new Map(sources.assets.map((asset) => [asset.id, asset]));
  const versions = new Set(sources.renderVersions.map((version) => version.id));

  for (const track of input.tracks) {
    for (const clip of track.clips) {
      if (clip.sourceAssetId) {
        const asset = assets.get(clip.sourceAssetId);
        if (!asset) {
          throw new TimelineValidationError(
            "TIMELINE_SOURCE_NOT_FOUND",
            "Timeline asset is not owned by this project."
          );
        }
        if (
          (track.kind === "VIDEO" && asset.kind !== "VIDEO") ||
          (track.kind === "AUDIO" && asset.kind !== "AUDIO")
        ) {
          throw new TimelineValidationError(
            "TIMELINE_SOURCE_KIND_INVALID",
            `${track.kind.toLowerCase()} tracks require matching project assets.`
          );
        }
      } else if (
        !clip.sourceRenderVersionId ||
        !versions.has(clip.sourceRenderVersionId)
      ) {
        throw new TimelineValidationError(
          "TIMELINE_SOURCE_NOT_FOUND",
          "Timeline render version is not owned by this project."
        );
      } else if (track.kind !== "VIDEO") {
        throw new TimelineValidationError(
          "TIMELINE_SOURCE_KIND_INVALID",
          "Render versions can only be placed on a video track."
        );
      }
    }
  }
}

function timelineDefaults() {
  return {
    revision: 1,
    fps: 24,
    durationMs: 0,
    audioMix: {
      masterMuted: false,
      masterVolume: 1,
      musicVolume: 1,
      voiceVolume: 1,
    },
    tracks: {
      create: [
        {
          position: 0,
          kind: "VIDEO" as const,
          name: "Video",
        },
        {
          position: 1,
          kind: "AUDIO" as const,
          name: "Audio",
        },
      ],
    },
  };
}

const timelineInclude = {
  tracks: {
    orderBy: { position: "asc" as const },
    include: {
      clips: {
        orderBy: [{ startMs: "asc" as const }, { position: "asc" as const }],
        include: {
          sourceAsset: {
            select: { id: true, label: true, kind: true },
          },
          sourceRenderVersion: {
            select: {
              id: true,
              number: true,
              status: true,
              provider: true,
              model: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ProjectTimelineInclude;

export async function getOrCreateProjectTimeline(input: {
  projectId: string;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: input.projectId, userId: input.userId },
      select: { id: true },
    });
    if (!project) throw new TimelineNotFoundError();
    return tx.projectTimeline.upsert({
      where: { projectId: project.id },
      create: { projectId: project.id, ...timelineDefaults() },
      update: {},
      include: timelineInclude,
    });
  });
}

export async function replaceProjectTimeline(input: {
  projectId: string;
  userId: string;
  update: TimelineUpdate;
}) {
  assertTimelinePositions(input.update);

  return prisma.$transaction(
    async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: input.projectId, userId: input.userId },
        select: { id: true },
      });
      if (!project) throw new TimelineNotFoundError();

      const timeline = await tx.projectTimeline.upsert({
        where: { projectId: project.id },
        create: { projectId: project.id, ...timelineDefaults() },
        update: {},
        select: { id: true, revision: true },
      });

      // Serialize writes to one EDL, then verify the supplied optimistic token.
      const [locked] = await tx.$queryRaw<Array<{ revision: number }>>(
        Prisma.sql`SELECT "revision" FROM "project_timelines" WHERE "id" = ${timeline.id} FOR UPDATE`
      );
      if (!locked || locked.revision !== input.update.revision) {
        throw new TimelineConflictError();
      }

      const assetIds = input.update.tracks.flatMap((track) =>
        track.clips.flatMap((clip) =>
          clip.sourceAssetId ? [clip.sourceAssetId] : []
        )
      );
      const versionIds = input.update.tracks.flatMap((track) =>
        track.clips.flatMap((clip) =>
          clip.sourceRenderVersionId ? [clip.sourceRenderVersionId] : []
        )
      );
      const [assets, renderVersions] = await Promise.all([
        tx.projectAsset.findMany({
          where: {
            id: { in: assetIds },
            projectId: project.id,
            userId: input.userId,
          },
          select: { id: true, kind: true },
        }),
        tx.renderVersion.findMany({
          where: { id: { in: versionIds }, projectId: project.id },
          select: { id: true },
        }),
      ]);
      assertTimelineSourceOwnership(input.update, { assets, renderVersions });

      const durationMs = input.update.tracks.reduce(
        (maxDuration, track) =>
          Math.max(
            maxDuration,
            ...track.clips.map((clip) => clip.startMs + clip.durationMs)
          ),
        0
      );

      await tx.projectTimelineTrack.deleteMany({ where: { timelineId: timeline.id } });
      await tx.projectTimeline.update({
        where: { id: timeline.id },
        data: {
          revision: { increment: 1 },
          fps: input.update.fps,
          durationMs,
          audioMix: input.update.audioMix,
          tracks: {
            create: input.update.tracks.map((track) => ({
              position: track.position,
              kind: track.kind,
              name: track.name,
              muted: track.muted,
              volume: track.volume,
              clips: {
                create: track.clips.map((clip) => ({
                  position: clip.position,
                  startMs: clip.startMs,
                  durationMs: clip.durationMs,
                  trimStartMs: clip.trimStartMs,
                  trimEndMs: clip.trimEndMs,
                  muted: clip.muted,
                  volume: clip.volume,
                  sourceAssetId: clip.sourceAssetId || null,
                  sourceRenderVersionId: clip.sourceRenderVersionId || null,
                  metadata: clip.metadata || Prisma.JsonNull,
                })),
              },
            })),
          },
        },
      });

      return tx.projectTimeline.findUniqueOrThrow({
        where: { id: timeline.id },
        include: timelineInclude,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
