import { NextRequest } from "next/server";
import { apiJson } from "@/lib/api/json-response";
import { clearAdminGateCookie } from "@/lib/admin/gate-cookie";
import { hasValidAdminGateCookie } from "@/lib/admin/require-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/gate — whether the master-passcode cookie is currently live. */
export async function GET(req: NextRequest) {
  const unlocked = await hasValidAdminGateCookie(req);
  return apiJson({ success: true, ok: true, unlocked });
}

/** POST /api/admin/gate — close the panel. No passcode; cookie is simply cleared. */
export async function POST() {
  const res = apiJson({ success: true, ok: true, unlocked: false });
  return clearAdminGateCookie(res);
}
