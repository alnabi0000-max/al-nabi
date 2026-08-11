import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  allowedBillingCountries,
  detectCountryFromRequest,
  formatPriceForLocale,
  makeRegionToken,
  resolveCheckoutQuote,
} from "@/lib/geo";
import { resolveLocale } from "@/lib/i18n/messages";
import { prisma } from "@/lib/prisma";
import { resolveUserByKey } from "@/lib/assets";
import { getLocalSessionUser } from "@/lib/auth/session";
import { COIN_PACKS } from "@/lib/credits";

const bodySchema = z.object({
  packId: z.enum(["starter", "pro", "hollywood", "director", "infinite"]),
  locale: z.string().optional(),
  alnabiyKey: z.string().optional().nullable(),
  clientPrice: z.number().optional(),
});

function stripeLocale(
  locale: string
):
  | "auto"
  | "en"
  | "fr"
  | "de"
  | "es"
  | "it"
  | "ja"
  | "pt"
  | "zh"
  | "nl"
  | "pl"
  | "tr"
  | "ar" {
  const map: Record<
    string,
    | "en"
    | "fr"
    | "de"
    | "es"
    | "it"
    | "ja"
    | "pt"
    | "zh"
    | "nl"
    | "pl"
    | "tr"
    | "ar"
  > = {
    en: "en",
    fr: "fr",
    de: "de",
    es: "es",
    it: "it",
    ja: "ja",
    pt: "pt",
    zh: "zh",
    nl: "nl",
    pl: "pl",
    tr: "tr",
    ar: "ar",
  };
  return map[locale] || "auto";
}

/**
 * Shared Stripe Checkout Session creator (PHASE 2).
 */
export async function createCheckoutSession(req: NextRequest) {
  const body = bodySchema.parse(await req.json());
  const country = detectCountryFromRequest(req);
  const locale = resolveLocale(
    body.locale ||
      req.headers.get("x-alnabiy-locale") ||
      req.cookies.get("alnabiy_locale")?.value ||
      "en"
  );

  const quote = resolveCheckoutQuote({
    packId: body.packId,
    country,
  });
  if (!quote.ok || !quote.packId || !quote.amountCents || !quote.tier) {
    return NextResponse.json(
      { ok: false, error: quote.error || "Quote failed" },
      { status: 400 }
    );
  }

  if (
    typeof body.clientPrice === "number" &&
    Math.abs(body.clientPrice - (quote.priceUsd || 0)) > 0.01
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: "PRICE_MISMATCH",
        error: "Price mismatch — geo lock",
      },
      { status: 409 }
    );
  }

  const regionToken = makeRegionToken(quote.tier, country);
  const { formatted } = formatPriceForLocale(quote.priceUsd!, locale);
  const allowed = allowedBillingCountries(quote.tier);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get("origin") ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  const user =
    (await resolveUserByKey(body.alnabiyKey)) ||
    (await getLocalSessionUser().catch(() => null));

  // Pending Purchase (DB mavjud bo‘lsa)
  let purchaseId: string | null = null;
  if (user) {
    try {
      const pack = COIN_PACKS.find((p) => p.id === quote.packId);
      const purchase = await prisma.purchase.create({
        data: {
          userId: user.id,
          packId: quote.packId,
          coins: quote.coins || pack?.coins || 0,
          bonus: quote.bonus || pack?.bonus || 0,
          amountCents: quote.amountCents,
          currency: "usd",
          status: "PENDING",
          regionToken,
        },
      });
      purchaseId = purchase.id;
    } catch {
      /* soft — DB yo‘q */
    }
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeKey) {
    /* Never mint coins without a real Stripe charge in production — a
     * missing STRIPE_SECRET_KEY must fail closed, not become a free-coin
     * faucet. Demo instant-credit is local/dev only. */
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_DEMO_CHECKOUT !== "1"
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "STRIPE_REQUIRED",
          error: "Billing temporarily unavailable",
        },
        { status: 503 }
      );
    }

    // Demo: darhol kredit (lokal sinov)
    if (user && purchaseId) {
      try {
        const credit = (quote.coins || 0) + (quote.bonus || 0);
        await prisma.$transaction(async (tx) => {
          const updated = await tx.user.update({
            where: { id: user.id },
            data: { coins: { increment: credit } },
          });
          await tx.purchase.update({
            where: { id: purchaseId! },
            data: {
              status: "PAID",
              stripeSessionId: `demo_${Date.now()}`,
            },
          });
          await tx.coinLedger.create({
            data: {
              userId: user.id,
              delta: credit,
              type: "PURCHASE",
              reason: `demo:checkout:${quote.packId}`,
              purchaseId: purchaseId!,
              balanceAfter: updated.coins,
            },
          });
        });
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({
      ok: true,
      mode: "demo",
      sessionId: `demo_${Date.now()}`,
      purchaseId,
      url: `${origin}/store?checkout=demo&pack=${quote.packId}&paid=1`,
      quote: {
        packId: quote.packId,
        price: quote.priceUsd,
        priceFormatted: formatted,
        currency: "USD",
        coins: quote.coins,
        bonus: quote.bonus,
        regionToken,
        country,
      },
      geo: {
        regionToken,
        billingHint: "card_country_must_match_region",
      },
    });
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeKey, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2024-11-20.acacia" as any,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${origin}/store?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/store?checkout=cancel`,
    billing_address_collection: "required",
    customer_creation: "always",
    locale: stripeLocale(locale),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: quote.amountCents,
          product_data: {
            name: `NC — ${quote.packId}`,
            description: `${(quote.coins || 0) + (quote.bonus || 0)} NC (${formatted})`,
            metadata: {
              pack_id: quote.packId,
              region_token: regionToken,
            },
          },
        },
      },
    ],
    payment_intent_data: {
      metadata: {
        pack_id: quote.packId,
        geo_tier: quote.tier,
        geo_country: country,
        region_token: regionToken,
        alnabiy_key: body.alnabiyKey || user?.alnabiyKey || "",
        user_id: user?.id || "",
        purchase_id: purchaseId || "",
        expected_amount_cents: String(quote.amountCents),
        allowed_billing: allowed.slice(0, 40).join(","),
      },
    },
    metadata: {
      pack_id: quote.packId,
      geo_tier: quote.tier,
      geo_country: country,
      region_token: regionToken,
      alnabiy_key: body.alnabiyKey || user?.alnabiyKey || "",
      user_id: user?.id || "",
      purchase_id: purchaseId || "",
      coins: String(quote.coins),
      bonus: String(quote.bonus),
      amount_cents: String(quote.amountCents),
      locale,
    },
    custom_text: {
      submit: {
        message:
          "Alnabiy Geo-Lock: billing country must match your detected region.",
      },
    },
  });

  if (purchaseId && session.id) {
    try {
      await prisma.purchase.update({
        where: { id: purchaseId },
        data: { stripeSessionId: session.id },
      });
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({
    ok: true,
    mode: "stripe",
    sessionId: session.id,
    purchaseId,
    url: session.url,
    quote: {
      packId: quote.packId,
      price: quote.priceUsd,
      priceFormatted: formatted,
      currency: "USD",
      coins: quote.coins,
      bonus: quote.bonus,
      regionToken,
      country,
    },
    geo: {
      regionToken,
      billingHint: "card_country_must_match_region",
    },
  });
}
