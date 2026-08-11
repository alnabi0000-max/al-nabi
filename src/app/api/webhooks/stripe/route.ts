import { NextRequest } from "next/server";
import { handleStripeWebhook } from "@/lib/stripe/webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PHASE 2 — canonical Stripe webhook */
export async function POST(req: NextRequest) {
  return handleStripeWebhook(req);
}
