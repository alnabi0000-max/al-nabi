import { NextRequest } from "next/server";
import {
  findOwnedProjectExport,
  presentProjectExport,
} from "@/lib/projects/export";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import {
  hasCredentialInQuery,
  isSafeProjectId,
  requireProjectUser,
} from "@/lib/projects/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; exportId: string }> };

/**
 * Returns lifecycle state and, only after a persisted completion, a short-lived
 * delivery URL. Private object keys and the stored worker snapshot stay hidden.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id: projectId, exportId } = await ctx.params;
    if (
      hasCredentialInQuery(req) ||
      !isSafeProjectId(projectId) ||
      !isSafeProjectId(exportId)
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
    const projectExport = await findOwnedProjectExport({
      projectId,
      exportId,
      userId: authenticated.user.id,
    });
    if (!projectExport) {
      return apiError("Export not found.", { status: 404, code: "NOT_FOUND" });
    }
    return apiJson({ projectExport: await presentProjectExport(projectExport) });
  } catch (error) {
    const formatted = formatRouteError(error);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
