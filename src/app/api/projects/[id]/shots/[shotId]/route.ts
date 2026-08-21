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

type Ctx = { params: Promise<{ id: string; shotId: string }> };

const updateShotSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    prompt: z.string().trim().max(8_000).optional().nullable(),
    negativePrompt: z.string().trim().max(4_000).optional().nullable(),
    aspect: z.enum(["16:9", "9:16", "1:1"]).optional().nullable(),
    quality: z.enum(["720p", "1080p", "4K"]).optional().nullable(),
    durationSec: z.number().int().min(1).max(15).optional().nullable(),
    preferredEngine: z.string().max(80).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied");

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id: projectId, shotId } = await ctx.params;
    if (
      hasCredentialInQuery(req) ||
      !isSafeProjectId(projectId) ||
      !isSafeProjectId(shotId)
    ) {
      return apiError("Invalid project request.", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
    const authenticated = await requireProjectUser(req);
    if (!authenticated) {
      return apiError("Unauthorized", { status: 401, code: "UNAUTHORIZED" });
    }
    const body = updateShotSchema.parse(await req.json());
    const shot = await prisma.shot.findFirst({
      where: { id: shotId, projectId, project: { userId: authenticated.user.id } },
      select: { id: true },
    });
    if (!shot) {
      return apiError("Shot not found.", { status: 404, code: "NOT_FOUND" });
    }
    const updated = await prisma.shot.update({
      where: { id: shot.id },
      data: body,
    });
    return apiJson({ shot: updated });
  } catch (error) {
    const formatted = formatRouteError(error);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
