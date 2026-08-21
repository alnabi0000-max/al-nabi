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

const createApprovalSchema = z.object({
  renderVersionId: z.string().min(1).max(100).optional().nullable(),
  shotId: z.string().min(1).max(100).optional().nullable(),
  decision: z.enum(["PENDING", "APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  comment: z.string().trim().max(4_000).optional().nullable(),
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
    const body = createApprovalSchema.parse(await req.json());
    if (!body.renderVersionId && !body.shotId) {
      return apiError("A render version or shot is required.", {
        status: 400,
        code: "APPROVAL_TARGET_REQUIRED",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: projectId, userId: authenticated.user.id },
        select: { id: true },
      });
      if (!project) throw new Error("PROJECT_NOT_FOUND");

      if (body.shotId) {
        const shot = await tx.shot.findFirst({
          where: { id: body.shotId, projectId },
          select: { id: true },
        });
        if (!shot) throw new Error("SHOT_NOT_FOUND");
      }

      if (body.renderVersionId) {
        const version = await tx.renderVersion.findFirst({
          where: {
            id: body.renderVersionId,
            projectId,
            ...(body.shotId ? { shotId: body.shotId } : {}),
          },
          select: { id: true },
        });
        if (!version) throw new Error("RENDER_VERSION_NOT_FOUND");
      }

      const approval = await tx.approval.create({
        data: {
          projectId,
          shotId: body.shotId || null,
          renderVersionId: body.renderVersionId || null,
          userId: authenticated.user.id,
          decision: body.decision,
          comment: body.comment || null,
        },
      });

      if (body.renderVersionId && body.decision !== "PENDING") {
        await tx.renderVersion.update({
          where: { id: body.renderVersionId },
          data: {
            status:
              body.decision === "APPROVED"
                ? "APPROVED"
                : body.decision === "REJECTED"
                  ? "REJECTED"
                  : "COMPLETED",
          },
        });
      }
      return approval;
    });
    return apiJson({ approval: result }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      ["PROJECT_NOT_FOUND", "SHOT_NOT_FOUND", "RENDER_VERSION_NOT_FOUND"].includes(
        error.message
      )
    ) {
      return apiError("Approval target not found.", {
        status: 404,
        code: error.message,
      });
    }
    const formatted = formatRouteError(error);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
