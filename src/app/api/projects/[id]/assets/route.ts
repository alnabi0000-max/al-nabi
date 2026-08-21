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

const attachGenerationAssetSchema = z.object({
  sourceGenerationId: z.string().min(1).max(100),
  label: z.string().trim().min(1).max(160).optional(),
});

/**
 * Attach only an existing, caller-owned private generation. This route does
 * not accept arbitrary remote URLs, avoiding an SSRF/public-media bypass.
 */
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
    const body = attachGenerationAssetSchema.parse(await req.json());

    const [project, generation] = await Promise.all([
      prisma.project.findFirst({
        where: { id: projectId, userId: authenticated.user.id },
        select: { id: true },
      }),
      prisma.generation.findFirst({
        where: {
          id: body.sourceGenerationId,
          userId: authenticated.user.id,
          status: "COMPLETED",
          deletedAt: null,
          r2Key: { not: null },
        },
        select: { id: true, type: true, r2Key: true, prompt: true },
      }),
    ]);
    if (!project) {
      return apiError("Project not found.", { status: 404, code: "NOT_FOUND" });
    }
    if (!generation?.r2Key) {
      return apiError("A completed private generation is required.", {
        status: 422,
        code: "PRIVATE_GENERATION_REQUIRED",
      });
    }

    const kind = generation.type === "IMAGE" ? "IMAGE" : "VIDEO";
    const asset = await prisma.projectAsset.create({
      data: {
        userId: authenticated.user.id,
        projectId,
        label: body.label || generation.prompt?.slice(0, 120) || "Generated asset",
        kind,
        sourceGenerationId: generation.id,
        r2Key: generation.r2Key,
      },
      select: {
        id: true,
        label: true,
        kind: true,
        sourceGenerationId: true,
        createdAt: true,
      },
    });
    return apiJson({ asset }, { status: 201 });
  } catch (error) {
    const formatted = formatRouteError(error);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
