import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import {
  hasCredentialInQuery,
  isSafeProjectId,
  requireProjectUser,
} from "@/lib/projects/api";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const createShotSchema = z.object({
  title: z.string().trim().min(1).max(120),
  prompt: z.string().trim().max(8_000).optional().nullable(),
  negativePrompt: z.string().trim().max(4_000).optional().nullable(),
  aspect: z.enum(["16:9", "9:16", "1:1"]).optional().nullable(),
  quality: z.enum(["720p", "1080p", "4K"]).optional().nullable(),
  durationSec: z.number().int().min(1).max(15).optional().nullable(),
  preferredEngine: z.string().max(80).optional().nullable(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id: projectId } = await ctx.params;
    if (hasCredentialInQuery(req) || !isSafeProjectId(projectId)) {
      return apiError("Invalid project request.", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
    const authenticated = await requireProjectUser(req);
    if (!authenticated) {
      return apiError("Unauthorized", { status: 401, code: "UNAUTHORIZED" });
    }
    const body = createShotSchema.parse(await req.json());
    const shot = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: projectId, userId: authenticated.user.id },
        select: { id: true },
      });
      if (!project) throw new Error("PROJECT_NOT_FOUND");

      const previous = await tx.shot.aggregate({
        where: { projectId },
        _max: { position: true },
      });
      return tx.shot.create({
        data: {
          projectId,
          position: (previous._max.position || 0) + 1,
          title: body.title,
          prompt: body.prompt || null,
          negativePrompt: body.negativePrompt || null,
          aspect: body.aspect || null,
          quality: body.quality || null,
          durationSec: body.durationSec || null,
          preferredEngine: body.preferredEngine || null,
        },
      });
    });
    return apiJson({ shot }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return apiError("Project not found.", { status: 404, code: "NOT_FOUND" });
    }
    const formatted = formatRouteError(error);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
