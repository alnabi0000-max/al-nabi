import { NextRequest } from "next/server";
import type { GenerationStatus } from "@prisma/client";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { requireAdminApiUser } from "@/lib/admin/require-admin";
import { loadAdminJobs } from "@/lib/admin/ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES = new Set<GenerationStatus>([
  "QUEUED",
  "ANALYZING",
  "GENERATING_AUDIO",
  "GENERATING_VIDEO",
  "MERGING",
  "COMPLETED",
  "FAILED",
]);

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiUser(req);
  if ("response" in auth) return auth.response;

  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") || "1");
    const statusRaw = (url.searchParams.get("status") || "ALL").trim();
    const status =
      statusRaw === "ALL" || STATUSES.has(statusRaw as GenerationStatus)
        ? (statusRaw as GenerationStatus | "ALL")
        : "ALL";
    const payload = await loadAdminJobs({
      q: url.searchParams.get("q") || undefined,
      status,
      page: Number.isFinite(page) ? page : 1,
    });
    return apiJson({ success: true, ok: true, ...payload });
  } catch (e) {
    const formatted = formatRouteError(e);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
