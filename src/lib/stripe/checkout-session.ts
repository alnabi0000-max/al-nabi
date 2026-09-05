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
import { ensureRequestLedgerUser } from "@/lib/auth/ensure-request-user";
import { COIN_PACKS, PACK_PRICE_IDS } from "@/lib/credits";
import { getStripePublishableKey, isStripeConfigured } from "@/lib/auth/config";
import { createStripeClient } from "@/lib/stripe/server";
import { creditPaidPurchase } from "@/lib/ledger/credit-purchase";
import { isDevelopmentNodeEnv } from "@/lib/env";
import { publicAppOriginFromRequest } from "@/lib/auth/oauth-origin";

const bodySchema = z.object({
  packId: z.enum(PACK_PRICE_IDS),
  locale: z.string().optional(),
  alnabiyKey: z.string().optional().nullable(),
  clientPrice: z.number().optional(),
  uiMode: z.enum(["embedded", "hosted"]).optional(),
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

function appOrigin(req: NextRequest): string {
  return publicAppOriginFromRequest(req);
}

/**
 * Shared Stripe Checkout Session creator (PHASE 2).
 * Embedded mode drives Apple Pay / Google Pay / card via Stripe Elements.
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
  const uiMode = body.uiMode === "hosted" ? "hosted" : "embedded";

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

  const ensured = await ensureRequestLedgerUser({
    request: req,
    alnabiyKey: body.alnabiyKey,
    allowGuest: isDevelopmentNodeEnv(),
  });
  if (!ensured) {
    return NextResponse.json(
      {
        ok: false,
        code: "AUTH_REQUIRED",
        error: "Sign in required",
      },
      { status: 401 }
    );
  }
  const user = ensured.user;

  const regionToken = makeRegionToken(quote.tier, country);
  const { formatted } = formatPriceForLocale(quote.priceUsd!, locale);
  const allowed = allowedBillingCountries(quote.tier);
  const origin = appOrigin(req);
  const pack = COIN_PACKS.find((p) => p.id === quote.packId);
  const coins = quote.coins || pack?.coins || 0;
  const bonus = quote.bonus || pack?.bonus || 0;

  let purchaseId: string | null = null;
  try {
    const purchase = await prisma.purchase.create({
      data: {
        userId: user.id,
        packId: quote.packId,
        coins,
        bonus,
        amountCents: quote.amountCents,
        currency: "usd",
        status: "PENDING",
        regionToken,
      },
    });
    purchaseId = purchase.id;
  } catch {
    /* DB unavailable — Stripe metadata still carries the quote */
  }

  const stripe = createStripeClient();
  if (!stripe || !isStripeConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          ok: false,
          code: "STRIPE_REQUIRED",
          error: "Billing temporarily unavailable",
        },
        { status: 503 }
      );
    }

    if (purchaseId) {
      try {
        await creditPaidPurchase({
          userId: user.id,
          packId: quote.packId,
          coins,
          bonus,
          amountCents: quote.amountCents,
          stripeSessionId: `demo_${purchaseId}`,
          purchaseId,
          regionToken,
          reason: `demo:checkout:${quote.packId}`,
        });
      } catch {
        /* ignore — client still gets a demo success URL */
      }
    }

    return NextResponse.json({
      ok: true,
      mode: "demo",
      sessionId: purchaseId ? `demo_${purchaseId}` : `demo_${Date.now()}`,
      purchaseId,
      ncCredited: coins + bonus,
      url: `${origin}/pricing?checkout=demo&pack=${quote.packId}&paid=1`,
      quote: {
        packId: quote.packId,
        price: quote.priceUsd,
        priceFormatted: formatted,
        currency: "USD",
        coins,
        bonus,
        regionToken,
        country,
      },
      geo: {
        regionToken,
        billingHint: "card_country_must_match_region",
      },
    });
  }

  const successPath = `/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelPath = `/pricing?checkout=cancel`;
  const metadata = {
    pack_id: quote.packId,
    geo_tier: quote.tier,
    geo_country: country,
    region_token: regionToken,
    alnabiy_key: user.alnabiyKey || "",
    user_id: user.id,
    purchase_id: purchaseId || "",
    coins: String(coins),
    bonus: String(bonus),
    amount_cents: String(quote.amountCents),
    locale,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...(uiMode === "embedded"
      ? {
          ui_mode: "embedded" as const,
          return_url: `${origin}${successPath}`,
          redirect_on_completion: "if_required" as const,
        }
      : {
          success_url: `${origin}${successPath}`,
          cancel_url: `${origin}${cancelPath}`,
        }),
    billing_address_collection: "required",
    customer_creation: "always",
    customer_email: user.email || undefined,
    locale: stripeLocale(locale),
    /* `card` unlocks Apple Pay + Google Pay wallets in Stripe Checkout / Elements. */
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: quote.amountCents,
          product_data: {
            name: `NC — ${pack?.name || quote.packId}`,
            description: `${coins + bonus} NC (${formatted}) · Apple Pay, Google Pay, card`,
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
        ...metadata,
        expected_amount_cents: String(quote.amountCents),
        allowed_billing: allowed.slice(0, 40).join(","),
      },
    },
    metadata,
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
    uiMode,
    sessionId: session.id,
    purchaseId,
    clientSecret: session.client_secret,
    publishableKey: getStripePublishableKey(),
    url: session.url,
    quote: {
      packId: quote.packId,
      price: quote.priceUsd,
      priceFormatted: formatted,
      currency: "USD",
      coins,
      bonus,
      regionToken,
      country,
    },
    geo: {
      regionToken,
      billingHint: "card_country_must_match_region",
    },
  });
}

export async function getCheckoutStatus(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "session_id required" },
      { status: 400 }
    );
  }

  const ensured = await ensureRequestLedgerUser({
    request: req,
    allowGuest: false,
  });
  if (!ensured) {
    return NextResponse.json(
      { ok: false, code: "AUTH_REQUIRED", error: "Sign in required" },
      { status: 401 }
    );
  }

  const purchase = await prisma.purchase.findUnique({
    where: { stripeSessionId: sessionId },
  });

  if (purchase && purchase.userId !== ensured.user.id) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: ensured.user.id },
    select: { coins: true },
  });
  const ncBalance = user?.coins ?? ensured.user.coins;

  if (purchase?.status === "PAID") {
    return NextResponse.json({
      ok: true,
      paid: true,
      status: "PAID",
      packId: purchase.packId,
      credited: purchase.coins + purchase.bonus,
      ncBalance,
      coins: ncBalance,
    });
  }

  if (sessionId.startsWith("demo_")) {
    return NextResponse.json({
      ok: true,
      paid: false,
      status: purchase?.status || "PENDING",
      ncBalance,
      coins: ncBalance,
    });
  }

  const stripe = createStripeClient();
  if (stripe && sessionId.startsWith("cs_")) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const stripePaid =
        session.payment_status === "paid" ||
        session.status === "complete";
      return NextResponse.json({
        ok: true,
        paid: false,
        processing: stripePaid,
        status: purchase?.status || session.status,
        packId: session.metadata?.pack_id || purchase?.packId,
        credited: purchase ? purchase.coins + purchase.bonus : undefined,
        ncBalance,
        coins: ncBalance,
      });
    } catch {
      /* fall through */
    }
  }

  return NextResponse.json({
    ok: true,
    paid: false,
    status: purchase?.status || "PENDING",
    ncBalance,
    coins: ncBalance,
  });
}
