import { createHash, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { apiError, apiJson } from "@/lib/api/json-response";
import { reconcileBillingRecords } from "@/lib/billing/reconcile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = req.headers.get("authorization");
  const token = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : null;
  if (!secret || !token) return false;
  return timingSafeEqual(
    createHash("sha256").update(token).digest(),
    createHash("sha256").update(secret).digest()
  );
}

/**
 * Schedule this endpoint with an external cron provider, or invoke it manually
 * with a CRON_SECRET bearer token. It identifies mismatches only.
 */
export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return apiError("Cron authentication is not configured", {
      status: 503,
      code: "CRON_SECRET_REQUIRED",
    });
  }
  if (!authorized(req)) {
    return apiError("Unauthorized", { status: 401, code: "UNAUTHORIZED" });
  }

  const result = await reconcileBillingRecords();
  return apiJson({ ...result });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
