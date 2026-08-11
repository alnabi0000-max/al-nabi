import { NextRequest } from "next/server";
import { apiError, apiJson } from "@/lib/api/json-response";
import { probeCoreHealth, PLATFORM } from "@/lib/system/core";
import { assertAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin core-system status — NC, vault fee, white-label engine, watch wiring.
 */
export async function GET(req: NextRequest) {
  const gate = assertAdmin(req);
  if (!gate.ok) {
    return apiError(gate.error, { status: 401, code: "UNAUTHORIZED" });
  }

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
}
