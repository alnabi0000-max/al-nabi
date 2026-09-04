import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolvePrivateDeliveryUrl } from "@/lib/storage/signed-url";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import {
  hasCredentialInQuery,
  isSafeProjectId,
  requireProjectUser,
} from "@/lib/projects/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const updateProjectSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    brief: z.string().trim().max(8_000).optional().nullable(),
    aspect: z.enum(["16:9", "9:16", "1:1"]).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    spendCapNc: z.number().int().min(1).max(1_000_000).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied");

async function projectForUser(id: string, userId: string) {
  return prisma.project.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      brief: true,
      aspect: true,
      status: true,
      spendCapNc: true,
      spentNc: true,
      reservedNc: true,
      createdAt: true,
      updatedAt: true,
      shots: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          title: true,
          prompt: true,
          negativePrompt: true,
          aspect: true,
          quality: true,
          durationSec: true,
          preferredEngine: true,
          updatedAt: true,
          renderVersions: {
            orderBy: { createdAt: "desc" },
            take: 12,
            select: {
              id: true,
              number: true,
              status: true,
              provider: true,
              model: true,
              outputR2Key: true,
              outputUrl: true,
              estimatedCredits: true,
              creditsCost: true,
              createdAt: true,
              approvals: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { id: true, decision: true, comment: true, createdAt: true },
              },
            },
          },
        },
      },
      assets: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          label: true,
          kind: true,
          sourceGenerationId: true,
          createdAt: true,
        },
      },
      referencePacks: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          notes: true,
          updatedAt: true,
          assets: { select: { id: true, label: true, kind: true } },
        },
      },
      renderVersions: {
        where: { shotId: null },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          number: true,
          status: true,
          outputR2Key: true,
          outputUrl: true,
          estimatedCredits: true,
          creditsCost: true,
          createdAt: true,
          approvals: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, decision: true, comment: true, createdAt: true },
          },
        },
      },
    },
  });
}

async function presentProject(project: NonNullable<Awaited<ReturnType<typeof projectForUser>>>) {
  const presentVersion = async <T extends { outputR2Key: string | null; outputUrl: string | null }>(
    version: T
  ) => {
    const { outputR2Key, outputUrl, ...safeVersion } = version;
    return {
      ...safeVersion,
      deliveryUrl: await resolvePrivateDeliveryUrl({
        objectKey: outputR2Key,
        resultUrl: outputUrl,
      }),
    };
  };

  return {
    ...project,
    renderVersions: await Promise.all(project.renderVersions.map(presentVersion)),
    shots: await Promise.all(
      project.shots.map(async (shot) => ({
        ...shot,
        renderVersions: await Promise.all(shot.renderVersions.map(presentVersion)),
      }))
    ),
  };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (hasCredentialInQuery(req)) {
      return apiError("Credentials in URL query parameters are not accepted.", {
        status: 400,
        code: "CREDENTIAL_IN_URL",
      });
    }
    if (!isSafeProjectId(id)) {
      return apiError("Invalid project id.", { status: 400, code: "INVALID_ID" });
    }
    const authenticated = await requireProjectUser(req);
    if (!authenticated) {
      return apiError("Unauthorized", { status: 401, code: "UNAUTHORIZED" });
    }
    const project = await projectForUser(id, authenticated.user.id);
    if (!project) {
      return apiError("Project not found.", { status: 404, code: "NOT_FOUND" });
    }
    return apiJson({ project: await presentProject(project) });
  } catch (error) {
    const formatted = formatRouteError(error);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (hasCredentialInQuery(req) || !isSafeProjectId(id)) {
      return apiError("Invalid project request.", {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }
    const authenticated = await requireProjectUser(req);
    if (!authenticated) {
      return apiError("Unauthorized", { status: 401, code: "UNAUTHORIZED" });
    }
    const body = updateProjectSchema.parse(await req.json());
    const existing = await prisma.project.findFirst({
      where: { id, userId: authenticated.user.id },
      select: { id: true, spentNc: true, reservedNc: true },
    });
    if (!existing) {
      return apiError("Project not found.", { status: 404, code: "NOT_FOUND" });
    }
    if (
      body.spendCapNc !== undefined &&
      body.spendCapNc !== null &&
      body.spendCapNc < existing.spentNc + existing.reservedNc
    ) {
      return apiError("Spend cap cannot be below committed project spend.", {
        status: 409,
        code: "PROJECT_SPEND_CAP",
      });
    }
    const project = await prisma.project.update({
      where: { id: existing.id },
      data: {
        title: body.title,
        brief: body.brief,
        aspect: body.aspect,
        status: body.status,
        spendCapNc: body.spendCapNc,
      },
    });
    return apiJson({ project });
  } catch (error) {
    const formatted = formatRouteError(error);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
