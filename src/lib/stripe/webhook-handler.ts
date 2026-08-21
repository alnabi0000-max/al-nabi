import { NextRequest, NextResponse } from "next/server";
import {
  isBillingCountryAllowed,
  resolveGeoTier,
  type GeoTier,
} from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { creditPaidPurchase } from "@/lib/ledger/credit-purchase";
import { sendPurchaseReceiptEmail } from "@/lib/email/purchase-receipt";
import {
  createStripeClient,
  getStripeSecretKey,
  getStripeWebhookSecret,
} from "@/lib/stripe/server";
import {
  claimBillingWebhookEvent,
  completeBillingWebhookEvent,
  failBillingWebhookEvent,
} from "@/lib/billing/webhook-events";
import { syncStripeSubscription } from "@/lib/billing/entitlements";
import { BillingProvider } from "@prisma/client";

/**
 * Stripe webhook — checkout.session.completed → Purchase PAID + CoinLedger PURCHASE
 */
export async function handleStripeWebhook(req: NextRequest) {
  const stripeKey = getStripeSecretKey();
  const whSecret = getStripeWebhookSecret();

  if (!stripeKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Billing webhook is unavailable until Stripe is configured.",
        code: "BILLING_CONFIGURATION_REQUIRED",
      },
      { status: 503 }
    );
  }

  let claimedEventId: string | null = null;
  try {
    const stripe = createStripeClient(stripeKey);
    if (!stripe) {
      return NextResponse.json(
        {
          ok: false,
          error: "Billing webhook is unavailable until Stripe is configured.",
          code: "BILLING_CONFIGURATION_REQUIRED",
        },
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
          error:
            "Billing webhook is unavailable until its signing secret is configured.",
          code: "BILLING_CONFIGURATION_REQUIRED",
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
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Webhook signature verification failed.",
          code: "WEBHOOK_SIGNATURE_INVALID",
        },
        { status: 400 }
      );
    }

    const object = event.data.object as {
      id?: string;
    };
    const claimed = await claimBillingWebhookEvent({
      provider: BillingProvider.STRIPE,
      providerEventId: event.id,
      eventType: event.type,
      providerObjectId: object.id || null,
      rawPayload: raw,
    });
    claimedEventId = claimed.eventId;
    if (!claimed.claimed) {
      return NextResponse.json({
        ok: true,
        received: true,
        duplicate: claimed.duplicate,
        processing: claimed.inProgress,
      });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        id?: string;
        mode?: string;
        customer?: string | { id?: string } | null;
        subscription?: string | { id?: string } | null;
        payment_intent?: string | { id?: string };
        metadata?: Record<string, string>;
        customer_details?: { address?: { country?: string } };
        amount_total?: number;
      };
      const meta = session.metadata || {};
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id || null;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id || null;

      if (session.mode === "subscription" || subscriptionId) {
        const user =
          (meta.user_id
            ? await prisma.user.findUnique({ where: { id: meta.user_id } })
            : null) ||
          (customerId
            ? await prisma.user.findUnique({
                where: { stripeCustomerId: customerId },
              })
            : null);
        if (!user || !customerId || !subscriptionId) {
          throw new Error("SUBSCRIPTION_OWNER_UNRESOLVED");
        }
        if (!user.stripeCustomerId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { stripeCustomerId: customerId },
          });
        }
        const synced = await syncStripeSubscription({
          userId: user.id,
          customerId,
          subscriptionId,
          planCode: meta.plan_code || meta.price_id || "subscription",
          status: meta.subscription_status || "active",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        });
        await completeBillingWebhookEvent({
          eventId: claimed.eventId,
          userId: user.id,
          subscriptionId: synced.subscription.id,
        });
        return NextResponse.json({ ok: true, received: true });
      }

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
        await completeBillingWebhookEvent({
          eventId: claimed.eventId,
          ignored: true,
        });
        return NextResponse.json({
          ok: false,
          code: "GEO_MISMATCH",
          flagged: true,
        });
      }

      const credit = coins + bonus;
      if (credit <= 0 || !session.id) {
        await completeBillingWebhookEvent({
          eventId: claimed.eventId,
          ignored: true,
        });
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
        if (purchaseIdMeta) {
          await prisma.purchase
            .updateMany({
              where: { id: purchaseIdMeta, status: { not: "PAID" } },
              data: { status: "FAILED" },
            })
            .catch(() => undefined);
        }
        throw new Error("PURCHASE_OWNER_UNRESOLVED");
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

      if (!result.duplicate && user.email) {
        void sendPurchaseReceiptEmail({
          email: user.email,
          name: user.name,
          packId,
          coins,
          bonus,
          amountCents,
          balanceAfter: result.ncBalance,
          stripeSessionId: session.id,
        }).catch((err) =>
          console.warn("[Alnabiy] purchase receipt email failed", err)
        );
      }

      await completeBillingWebhookEvent({
        eventId: claimed.eventId,
        userId: user.id,
        purchaseId: result.purchaseId,
      });
      return NextResponse.json({
        ok: true,
        received: true,
        duplicate: result.duplicate,
        ncBalance: result.ncBalance,
      });
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as {
        id?: string;
        customer?: string | { id?: string };
        status?: string;
        cancel_at_period_end?: boolean;
        current_period_end?: number;
        items?: { data?: Array<{ price?: { id?: string } }> };
      };
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id || null;
      const user = customerId
        ? await prisma.user.findUnique({
            where: { stripeCustomerId: customerId },
          })
        : null;
      if (!user || !customerId || !subscription.id || !subscription.status) {
        throw new Error("SUBSCRIPTION_OWNER_UNRESOLVED");
      }
      const synced = await syncStripeSubscription({
        userId: user.id,
        customerId,
        subscriptionId: subscription.id,
        planCode: subscription.items?.data?.[0]?.price?.id || "subscription",
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      });
      await completeBillingWebhookEvent({
        eventId: claimed.eventId,
        userId: user.id,
        subscriptionId: synced.subscription.id,
      });
      return NextResponse.json({ ok: true, received: true });
    }

    await completeBillingWebhookEvent({
      eventId: claimed.eventId,
      ignored: true,
    });
    return NextResponse.json({ ok: true, received: true });
  } catch (e) {
    if (claimedEventId) {
      await failBillingWebhookEvent({
        eventId: claimedEventId,
        errorCode:
          e instanceof Error && /^[A-Z_]+$/.test(e.message)
            ? e.message
            : "WEBHOOK_PROCESSING_FAILED",
      }).catch(() => undefined);
    }
    return NextResponse.json(
      {
        ok: false,
        error: "Billing event processing failed and will require reconciliation.",
        code: "BILLING_EVENT_PROCESSING_FAILED",
      },
      { status: 500 }
    );
  }
}
