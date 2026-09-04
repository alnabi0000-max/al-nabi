import { prisma } from "@/lib/prisma";
import type { ProjectAssetKind } from "@prisma/client";

export class ProjectAssetAttachError extends Error {
  constructor(
    public readonly code:
      | "PROJECT_NOT_FOUND"
      | "PRIVATE_GENERATION_REQUIRED"
  ) {
    super(code);
    this.name = "ProjectAssetAttachError";
  }
}

const assetSelect = {
  id: true,
  label: true,
  kind: true,
  sourceGenerationId: true,
  createdAt: true,
} as const;

export type ProjectAssetSummary = {
  id: string;
  label: string;
  kind: ProjectAssetKind;
  sourceGenerationId: string | null;
  createdAt: Date;
};

/**
 * Attach a caller-owned completed generation to a project exactly once.
 * The private object key is copied from the generation; no remote URL is accepted.
 */
export async function attachCompletedGenerationAsset(input: {
  userId: string;
  projectId: string;
  generationId: string;
  label?: string;
}): Promise<{ asset: ProjectAssetSummary; created: boolean }> {
  const [project, generation] = await Promise.all([
    prisma.project.findFirst({
      where: { id: input.projectId, userId: input.userId },
      select: { id: true },
    }),
    prisma.generation.findFirst({
      where: {
        id: input.generationId,
        userId: input.userId,
        status: "COMPLETED",
        deletedAt: null,
        r2Key: { not: null },
      },
      select: { id: true, type: true, r2Key: true, prompt: true },
    }),
  ]);

  if (!project) throw new ProjectAssetAttachError("PROJECT_NOT_FOUND");
  if (!generation?.r2Key) {
    throw new ProjectAssetAttachError("PRIVATE_GENERATION_REQUIRED");
  }

  const existing = await prisma.projectAsset.findFirst({
    where: {
      projectId: project.id,
      sourceGenerationId: generation.id,
    },
    select: assetSelect,
  });
  if (existing) return { asset: existing, created: false };

  const kind: ProjectAssetKind =
    generation.type === "IMAGE" ? "IMAGE" : "VIDEO";

  try {
    const asset = await prisma.projectAsset.create({
      data: {
        userId: input.userId,
        projectId: project.id,
        label:
          input.label?.trim() ||
          generation.prompt?.slice(0, 120) ||
          "Generated asset",
        kind,
        sourceGenerationId: generation.id,
        r2Key: generation.r2Key,
      },
      select: assetSelect,
    });
    return { asset, created: true };
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2002") {
      const raced = await prisma.projectAsset.findFirst({
        where: {
          projectId: project.id,
          sourceGenerationId: generation.id,
        },
        select: assetSelect,
      });
      if (raced) return { asset: raced, created: false };
    }
    throw error;
  }
}
