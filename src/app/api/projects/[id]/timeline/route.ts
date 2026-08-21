import { NextRequest } from "next/server";
import {
  TimelineConflictError,
  TimelineNotFoundError,
  TimelineValidationError,
  getOrCreateProjectTimeline,
  replaceProjectTimeline,
  timelineUpdateSchema,
} from "@/lib/projects/timeline";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import {
  hasCredentialInQuery,
  isSafeProjectId,
  requireProjectUser,
} from "@/lib/projects/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function timelineError(error: unknown) {
  if (error instanceof TimelineNotFoundError) {
    return apiError("Project not found.", { status: 404, code: "NOT_FOUND" });
  }
  if (error instanceof TimelineConflictError) {
    return apiError(error.message, { status: 409, code: "TIMELINE_REVISION_CONFLICT" });
  }
  if (error instanceof TimelineValidationError) {
    return apiError(error.message, { status: 422, code: error.code });
  }
  if ((error as { code?: string } | null)?.code === "P2034") {
    return apiError("Timeline was changed concurrently. Refresh before saving.", {
      status: 409,
      code: "TIMELINE_REVISION_CONFLICT",
    });
  }
  const formatted = formatRouteError(error);
  return apiError(formatted.message, {
    status: formatted.status,
    code: formatted.code,
  });
}

/**
 * The timeline response exposes only owned IDs and descriptive metadata.
 * Private object keys and upstream URLs remain server-side.
 */
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
    const timeline = await getOrCreateProjectTimeline({
      projectId,
      userId: authenticated.user.id,
    });
    return apiJson({ timeline });
  } catch (error) {
    return timelineError(error);
  }
}

/**
 * Replaces the canonical EDL inside one serializable transaction. The caller
 * must submit the last observed revision to prevent silent lost updates.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
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
    const update = timelineUpdateSchema.parse(await req.json());
    const timeline = await replaceProjectTimeline({
      projectId,
      userId: authenticated.user.id,
      update,
    });
    return apiJson({ timeline });
  } catch (error) {
    return timelineError(error);
  }
}
