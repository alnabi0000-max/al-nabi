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

const createReferencePackSchema = z.object({
  title: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(4_000).optional().nullable(),
  assetIds: z.array(z.string().min(1).max(100)).min(1).max(30),
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
    const body = createReferencePackSchema.parse(await req.json());
    const ids = [...new Set(body.assetIds)];

    const [project, assets] = await Promise.all([
      prisma.project.findFirst({
        where: { id: projectId, userId: authenticated.user.id },
        select: { id: true },
      }),
      prisma.projectAsset.findMany({
        where: {
          id: { in: ids },
          projectId,
          userId: authenticated.user.id,
        },
        select: { id: true },
      }),
    ]);
    if (!project) {
      return apiError("Project not found.", { status: 404, code: "NOT_FOUND" });
    }
    if (assets.length !== ids.length) {
      return apiError("Reference assets must belong to this project.", {
        status: 422,
        code: "INVALID_REFERENCE_ASSET",
      });
    }
    const referencePack = await prisma.referencePack.create({
      data: {
        projectId,
        title: body.title,
        notes: body.notes || null,
        assets: { connect: assets.map((asset) => ({ id: asset.id })) },
      },
      include: { assets: { select: { id: true, label: true, kind: true } } },
    });
    return apiJson({ referencePack }, { status: 201 });
  } catch (error) {
    const formatted = formatRouteError(error);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
