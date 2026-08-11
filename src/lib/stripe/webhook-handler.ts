import { NextRequest, NextResponse } from "next/server";
import {
  isBillingCountryAllowed,
  resolveGeoTier,
  type GeoTier,
} from "@/lib/geo";
import { prisma } from "@/lib/prisma";

/**
 * Stripe webhook — checkout.session.completed → Purchase PAID + CoinLedger PURCHASE
 */
export async function handleStripeWebhook(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripeKey) {
    return NextResponse.json(
      { ok: false, error: "Stripe not configured" },
      { status: 503 }
    );
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: "2024-11-20.acacia" as any,
    });

    const raw = await req.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let event: any;

    if (!whSecret) {
      /* Never credit coins from unsigned webhooks (forgery risk). */
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
      /* Bad/forged signature or wrong secret — this will never succeed on
       * retry, so 400 tells Stripe not to keep resending it. */
      const msg = sigError instanceof Error ? sigError.message : "Invalid signature";
      console.error("[Alnabiy] Stripe webhook signature verification failed", msg);
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
        parseInt(meta.amount_cents || "0", 10) ||
        session.amount_total ||
        0;

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
        /* Money was captured but we deliberately withhold coins on a geo
         * mismatch (fraud signal) — mark the pending Purchase row FAILED so
         * it is visible/auditable instead of silently vanishing into logs.
         * We return 200: retrying will not change the outcome, a human must
         * review this case. */
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

      // Fast-path idempotency check (real safety net is the atomic claim below)
      if (session.id) {
        const existing = await prisma.purchase.findUnique({
          where: { stripeSessionId: session.id },
        });
        if (existing?.status === "PAID") {
          return NextResponse.json({
            ok: true,
            received: true,
            duplicate: true,
          });
        }
      }

      const credit = coins + bonus;
      if (credit <= 0) {
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
        console.error("[Alnabiy] Stripe webhook: user not found — payment captured, no credit issued", {
          sessionId: session.id,
          userIdMeta,
          alnabiyKey,
          purchaseIdMeta,
        });
        if (purchaseIdMeta) {
          await prisma.purchase
            .updateMany({
              where: { id: purchaseIdMeta, status: { not: "PAID" } },
              data: { status: "FAILED" },
            })
            .catch(() => undefined);
        }
        /* 500 → Stripe retries with backoff for up to 3 days and surfaces this
         * as a failing webhook in the Stripe dashboard, instead of silently
         * dropping a paid-but-uncredited purchase. */
        return NextResponse.json(
          { ok: false, error: "User not found for credit" },
          { status: 500 }
        );
      }

      const pi =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null;

      await prisma.$transaction(async (tx) => {
        let purchaseId = purchaseIdMeta || null;

        if (!purchaseId) {
          if (session.id) {
            const created = await tx.purchase.upsert({
              where: { stripeSessionId: session.id },
              create: {
                userId: user.id,
                packId,
                coins,
                bonus,
                amountCents,
                currency: "usd",
                status: "PENDING",
                stripeSessionId: session.id,
                stripePaymentIntentId: pi,
                regionToken: meta.region_token || null,
              },
              update: {},
            });
            purchaseId = created.id;
          } else {
            const created = await tx.purchase.create({
              data: {
                userId: user.id,
                packId,
                coins,
                bonus,
                amountCents,
                currency: "usd",
                status: "PENDING",
                stripePaymentIntentId: pi,
                regionToken: meta.region_token || null,
              },
            });
            purchaseId = created.id;
          }
        }

        /* Atomic claim — only the first delivery to observe status != PAID
         * flips it to PAID and proceeds to credit coins. Any concurrent or
         * later duplicate Stripe webhook delivery for the same purchase sees
         * claim.count === 0 and is a safe no-op (fixes the prior
         * check-then-increment double-credit race). */
        const claim = await tx.purchase.updateMany({
          where: { id: purchaseId, status: { not: "PAID" } },
          data: {
            status: "PAID",
            stripeSessionId: session.id || undefined,
            stripePaymentIntentId: pi,
            amountCents,
          },
        });
        if (claim.count === 0) {
          return;
        }

        const updated = await tx.user.update({
          where: { id: user.id },
          data: { coins: { increment: credit } },
        });

        await tx.coinLedger.create({
          data: {
            userId: user.id,
            delta: credit,
            type: "PURCHASE",
            reason: `stripe:checkout:${packId}`,
            purchaseId: purchaseId!,
            jobId: String(session.id || ""),
            balanceAfter: updated.coins,
            metadata: {
              stripeSessionId: session.id,
              packId,
              coins,
              bonus,
            },
          },
        });
      });
    }

    return NextResponse.json({ ok: true, received: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook error";
    console.error("[Alnabiy] Stripe webhook error", msg);
    /* 500 → Stripe retries. A thrown error here means we could not verify or
     * process the event; retrying (rather than a 4xx) gives eventual
     * consistency a chance and avoids silently losing a paid purchase. */
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
