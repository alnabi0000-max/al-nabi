import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import {
  hasCredentialInQuery,
  isSafeProjectId,
  requireProjectUser,
} from "@/lib/projects/api";
import {
  attachCompletedGenerationAsset,
  ProjectAssetAttachError,
} from "@/lib/projects/assets";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const attachGenerationAssetSchema = z.object({
  sourceGenerationId: z.string().min(1).max(100),
  label: z.string().trim().min(1).max(160).optional(),
});

const assetSelect = {
  id: true,
  label: true,
  kind: true,
  sourceGenerationId: true,
  createdAt: true,
} as const;

/** List only the caller's private project assets — never object keys. */
export async function GET(req: NextRequest, ctx: Ctx) {
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
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: authenticated.user.id },
      select: { id: true },
    });
    if (!project) {
      return apiError("Project not found.", { status: 404, code: "NOT_FOUND" });
    }
    const assets = await prisma.projectAsset.findMany({
      where: { projectId: project.id, userId: authenticated.user.id },
      orderBy: { createdAt: "desc" },
      select: assetSelect,
    });
    return apiJson({ assets });
  } catch (error) {
    const formatted = formatRouteError(error);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}

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
    const { asset, created } = await attachCompletedGenerationAsset({
      userId: authenticated.user.id,
      projectId,
      generationId: body.sourceGenerationId,
      label: body.label,
    });
    return apiJson({ asset }, { status: created ? 201 : 200 });
  } catch (error) {
    if (error instanceof ProjectAssetAttachError) {
      return apiError(
        error.code === "PROJECT_NOT_FOUND"
          ? "Project not found."
          : "A completed private generation is required.",
        {
          status: error.code === "PROJECT_NOT_FOUND" ? 404 : 422,
          code: error.code,
        }
      );
    }
    const formatted = formatRouteError(error);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
