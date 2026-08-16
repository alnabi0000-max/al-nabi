import { NextRequest, NextResponse } from "next/server";
import {
  createCheckoutSession,
  getCheckoutStatus,
} from "@/lib/stripe/checkout-session";
import { guardSensitiveRequest } from "@/lib/security/request-guard";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PHASE 2 — Stripe Checkout (Apple Pay, Google Pay, cards via Elements).
 * POST creates an embedded or hosted Checkout Session.
 * GET polls payment + ledger status after return.
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

export async function GET(req: NextRequest) {
  try {
    return await getCheckoutStatus(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Status failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
