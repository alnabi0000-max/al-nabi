import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe/checkout-session";
import { guardSensitiveRequest } from "@/lib/security/request-guard";
import * as Sentry from "@sentry/nextjs";

/**
 * PHASE 2 — POST /api/checkout/create-session
 */
export async function POST(req: NextRequest) {
  try {
    const blocked = await guardSensitiveRequest(req);
    if (blocked) return blocked;
    return await createCheckoutSession(req);
  } catch (e) {
    Sentry.captureException(e);
    const msg = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
