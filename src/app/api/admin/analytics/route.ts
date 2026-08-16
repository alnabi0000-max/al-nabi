import { NextRequest } from "next/server";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { requireAdminApiUser } from "@/lib/admin/require-admin";
import {
  AnalyticsRangeError,
  isAnalyticsRangeKey,
  loadAdminAnalytics,
} from "@/lib/admin/analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/analytics
 * Session + Prisma role ADMIN only.
 * Query: range=today|5days|weekly|monthly|custom&from=&to=
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminApiUser(req);
  if ("response" in auth) return auth.response;

  try {
    const url = new URL(req.url);
    const rangeRaw = (url.searchParams.get("range") || "today").trim();
    if (!isAnalyticsRangeKey(rangeRaw)) {
      return apiError("Invalid range", { status: 400, code: "INVALID_RANGE" });
    }

    const payload = await loadAdminAnalytics({
      range: rangeRaw,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
    });

    return apiJson({
      success: true,
      ok: true,
      ...payload,
    });
  } catch (e) {
    if (e instanceof AnalyticsRangeError) {
      return apiError(e.message, { status: 400, code: e.code });
    }
    const formatted = formatRouteError(e);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
