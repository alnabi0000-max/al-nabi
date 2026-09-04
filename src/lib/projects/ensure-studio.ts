import type { Prisma } from "@prisma/client";

const DEFAULT_TITLE = "Studio";

/**
 * Attach a Generation to the caller's active project (and a first shot).
 * Reuses the newest non-archived project, or creates a Studio workspace.
 */
export async function ensureStudioWorkspace(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    projectId?: string | null;
    shotId?: string | null;
    aspect: "16:9" | "9:16" | "1:1";
    prompt?: string | null;
  }
): Promise<{ projectId: string; shotId: string | null }> {
  let projectId = input.projectId?.trim() || null;
  let shotId = input.shotId?.trim() || null;

  if (projectId) {
    const project = await tx.project.findFirst({
      where: { id: projectId, userId: input.userId },
      select: { id: true },
    });
    if (!project) throw new Error("PROJECT_NOT_FOUND");

    if (shotId) {
      const shot = await tx.shot.findFirst({
        where: { id: shotId, projectId: project.id },
        select: { id: true },
      });
      if (!shot) throw new Error("SHOT_NOT_FOUND");
      return { projectId: project.id, shotId: shot.id };
    }

    const existingShot = await tx.shot.findFirst({
      where: { projectId: project.id },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    return {
      projectId: project.id,
      shotId: existingShot?.id ?? (await createFirstShot(tx, project.id, input)),
    };
  }

  const existing = await tx.project.findFirst({
    where: { userId: input.userId, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  const project = existing
    ? existing
    : await tx.project.create({
        data: {
          userId: input.userId,
          title: DEFAULT_TITLE,
          aspect: input.aspect,
          status: "ACTIVE",
        },
        select: { id: true },
      });

  const shot = await tx.shot.findFirst({
    where: { projectId: project.id },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  return {
    projectId: project.id,
    shotId: shot?.id ?? (await createFirstShot(tx, project.id, input)),
  };
}

async function createFirstShot(
  tx: Prisma.TransactionClient,
  projectId: string,
  input: { aspect: "16:9" | "9:16" | "1:1"; prompt?: string | null }
): Promise<string> {
  const created = await tx.shot.create({
    data: {
      projectId,
      position: 1,
      title: "Shot 1",
      prompt: input.prompt?.slice(0, 8_000) || null,
      aspect: input.aspect,
    },
    select: { id: true },
  });
  return created.id;
}
