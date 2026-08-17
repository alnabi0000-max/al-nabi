import { NextRequest } from "next/server";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { probeCoreHealth, PLATFORM } from "@/lib/system/core";
import { requireAdminApiUser } from "@/lib/admin/require-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin core-system status — NC, vault fee, white-label engine, watch wiring.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminApiUser(req);
  if ("response" in auth) return auth.response;

  try {
    const health = probeCoreHealth();
    return apiJson({
      success: true,
      ok: true,
      platform: PLATFORM,
      health,
      cronPath: "/api/cron/model-watch",
      adminUi: "/admin",
      notes: [
        "Currency label is always NC (Nabi Credits).",
        `Cloud Vault re-download fee: ${PLATFORM.archiveRedownloadFeeNc} NC after first free unlock.`,
        "All user-facing AI routes return Al-Nabi Native Engine.",
        "Model watcher alerts Telegram + Admin Dashboard; Approve & Swap updates endpoints without code deploy.",
      ],
    });
  } catch (e) {
    const formatted = formatRouteError(e);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
