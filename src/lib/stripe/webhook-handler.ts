import { NextRequest, NextResponse } from "next/server";
import {
  isBillingCountryAllowed,
  resolveGeoTier,
  type GeoTier,
} from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { creditPaidPurchase } from "@/lib/ledger/credit-purchase";
import {
  createStripeClient,
  getStripeSecretKey,
  getStripeWebhookSecret,
} from "@/lib/stripe/server";

/**
 * Stripe webhook — checkout.session.completed → Purchase PAID + CoinLedger PURCHASE
 */
export async function handleStripeWebhook(req: NextRequest) {
  const stripeKey = getStripeSecretKey();
  const whSecret = getStripeWebhookSecret();

  if (!stripeKey) {
    return NextResponse.json(
      { ok: false, error: "Stripe not configured" },
      { status: 503 }
    );
  }

  try {
    const stripe = createStripeClient(stripeKey);
    if (!stripe) {
      return NextResponse.json(
        { ok: false, error: "Stripe not configured" },
        { status: 503 }
      );
    }

    const raw = await req.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let event: any;

    if (!whSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: "STRIPE_WEBHOOK_SECRET not configured",
          code: "WEBHOOK_SECRET_REQUIRED",
        },
        { status: 503 }
      );
    }
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }
    try {
      event = stripe.webhooks.constructEvent(raw, sig, whSecret);
    } catch (sigError) {
      const msg =
        sigError instanceof Error ? sigError.message : "Invalid signature";
      console.error(
        "[Alnabiy] Stripe webhook signature verification failed",
        msg
      );
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        id?: string;
        payment_intent?: string | { id?: string };
        metadata?: Record<string, string>;
        customer_details?: { address?: { country?: string } };
        amount_total?: number;
      };
      const meta = session.metadata || {};
      const geoTier = (meta.geo_tier || "T1") as GeoTier;
      const geoCountry = meta.geo_country || "XX";
      const packId = meta.pack_id || "unknown";
      const alnabiyKey = meta.alnabiy_key;
      const userIdMeta = meta.user_id;
      const purchaseIdMeta = meta.purchase_id;
      const coins = parseInt(meta.coins || "0", 10);
      const bonus = parseInt(meta.bonus || "0", 10);
      const amountCents =
        parseInt(meta.amount_cents || "0", 10) || session.amount_total || 0;

      const billingCountry =
        session.customer_details?.address?.country || null;
      const allowed = isBillingCountryAllowed(geoTier, billingCountry);
      const detectedTier = resolveGeoTier(geoCountry);

      if (!allowed || detectedTier !== geoTier) {
        console.warn("[Alnabiy Geo-Lock] FRAUD FLAG", {
          sessionId: session.id,
          geoTier,
          geoCountry,
          billingCountry,
          packId,
        });
        if (purchaseIdMeta) {
          await prisma.purchase
            .updateMany({
              where: { id: purchaseIdMeta, status: { not: "PAID" } },
              data: { status: "FAILED" },
            })
            .catch(() => undefined);
        }
        return NextResponse.json({
          ok: false,
          code: "GEO_MISMATCH",
          flagged: true,
        });
      }

      const credit = coins + bonus;
      if (credit <= 0 || !session.id) {
        return NextResponse.json({ ok: true, received: true, skipped: true });
      }

      const user =
        (userIdMeta
          ? await prisma.user.findUnique({ where: { id: userIdMeta } })
          : null) ||
        (alnabiyKey
          ? await prisma.user.findUnique({ where: { alnabiyKey } })
          : null);

      if (!user) {
        console.error(
          "[Alnabiy] Stripe webhook: user not found — payment captured, no credit issued",
          {
            sessionId: session.id,
            userIdMeta,
            alnabiyKey,
            purchaseIdMeta,
          }
        );
        if (purchaseIdMeta) {
          await prisma.purchase
            .updateMany({
              where: { id: purchaseIdMeta, status: { not: "PAID" } },
              data: { status: "FAILED" },
            })
            .catch(() => undefined);
        }
        return NextResponse.json(
          { ok: false, error: "User not found for credit" },
          { status: 500 }
        );
      }

      const pi =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null;

      const result = await creditPaidPurchase({
        userId: user.id,
        packId,
        coins,
        bonus,
        amountCents,
        stripeSessionId: session.id,
        stripePaymentIntentId: pi,
        regionToken: meta.region_token || null,
        purchaseId: purchaseIdMeta || null,
        reason: `stripe:checkout:${packId}`,
      });

      return NextResponse.json({
        ok: true,
        received: true,
        duplicate: result.duplicate,
        ncBalance: result.ncBalance,
      });
    }

    return NextResponse.json({ ok: true, received: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook error";
    console.error("[Alnabiy] Stripe webhook error", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
