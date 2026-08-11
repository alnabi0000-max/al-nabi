import { NextRequest } from "next/server";
import { apiError, apiJson } from "@/lib/api/json-response";
import { runModelWatchCycle } from "@/lib/admin/model-watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cron endpoint — Vercel Cron / external scheduler.
 * Auth: Authorization: Bearer CRON_SECRET or ADMIN_API_SECRET
 */
export async function GET(req: NextRequest) {
  const secret =
    process.env.CRON_SECRET?.trim() ||
    process.env.ADMIN_API_SECRET?.trim();
  const auth = req.headers.get("authorization");
  /* Bearer header only — a `?secret=` query param leaks via logs/Referer */
  const token = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;

  if (!secret || !token || token !== secret) {
    return apiError("Unauthorized", { status: 401, code: "UNAUTHORIZED" });
  }

  const result = await runModelWatchCycle();
  return apiJson({ success: true, ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
