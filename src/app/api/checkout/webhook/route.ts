import { NextRequest } from "next/server";
import { handleStripeWebhook } from "@/lib/stripe/webhook-handler";

/** Legacy alias → /api/webhooks/stripe */
export async function POST(req: NextRequest) {
  return handleStripeWebhook(req);
}
