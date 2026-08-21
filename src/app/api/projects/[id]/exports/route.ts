import { NextRequest } from "next/server";
import {
  ProjectExportError,
  exportRequestSchema,
  isProjectSpendCapError,
  presentProjectExport,
  requestProjectExport,
} from "@/lib/projects/export";
import { enqueueProjectExport } from "@/lib/projects/export-enqueue";
import { failAndRefundGeneration } from "@/lib/generation/fail-and-refund";
import { prisma } from "@/lib/prisma";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import {
  hasCredentialInQuery,
  isSafeProjectId,
  requireProjectUser,
} from "@/lib/projects/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function exportError(error: unknown) {
  if (isProjectSpendCapError(error)) {
    return apiError("This project has reached its spend cap.", {
      status: 409,
      code: "PROJECT_SPEND_CAP",
    });
  }
  if (error instanceof ProjectExportError) {
    const status =
      error.code === "PROJECT_NOT_FOUND"
        ? 404
        : error.code === "EXPORT_TIMELINE_STALE"
        ? 409
        : error.code === "IDEMPOTENCY_KEY_REUSED"
          ? 409
          : 422;
    return apiError(error.message, { status, code: error.code });
  }
  if (
    error instanceof Error &&
    error.message.startsWith("EXPORT_CREDIT_PREFLIGHT:")
  ) {
    const [, code = "ERROR", message = "Export credit preflight failed"] =
      error.message.split(":", 3);
    return apiError(message, {
      status: code === "INSUFFICIENT" ? 402 : code === "BANNED" ? 403 : 400,
      code,
    });
  }
  const formatted = formatRouteError(error);
  return apiError(formatted.message, {
    status: formatted.status,
    code: formatted.code,
  });
}

/**
 * Creates a private, idempotent export request. The route accepts only the
 * current timeline revision and render settings; every media input is resolved
 * from owned persisted timeline source IDs on the server.
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
    const request = exportRequestSchema.parse(await req.json());
    const result = await requestProjectExport({
      projectId,
      userId: authenticated.user.id,
      request,
    });

    let queueMode: "inngest" | "local" | null = null;
    if (result.created && result.projectExport.status === "QUEUED") {
      try {
        const queued = await enqueueProjectExport(result.projectExport.id);
        queueMode = queued.mode;
      } catch (queueError) {
        const generationId = result.projectExport.generation?.id;
        if (generationId) {
          await failAndRefundGeneration({
            generationId,
            error: queueError,
            area: "project-export-enqueue",
          });
        }
        await prisma.projectExport.update({
          where: { id: result.projectExport.id },
          data: {
            status: "FAILED",
            errorCode: "EXPORT_QUEUE_UNAVAILABLE",
            errorMessage: "Export work could not be queued. No charge was retained.",
          },
        });
        return apiError("Export work could not be queued. No charge was retained.", {
          status: 503,
          code: "EXPORT_QUEUE_UNAVAILABLE",
        });
      }
    }

    const projectExport = await prisma.projectExport.findUniqueOrThrow({
      where: { id: result.projectExport.id },
      include: {
        generation: { select: { id: true, status: true, creditsCost: true } },
      },
    });
    return apiJson(
      {
        projectExport: await presentProjectExport(projectExport),
        queueMode,
        configurationRequired: result.configuration.configured
          ? null
          : result.configuration.reason,
      },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    return exportError(error);
  }
}
