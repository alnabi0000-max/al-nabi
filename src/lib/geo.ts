/**
 * Official NC package pricing — SERVER ONLY.
 * List prices are fixed USD ($20–$100). Geo-lock is used only for
 * checkout fraud controls (billing-country match), never to change price.
 */

import type { NextRequest } from "next/server";
import {
  COIN_PACKS,
  STANDARD_VIDEO_NC,
  isPackPriceId,
  type PackPriceId,
} from "@/lib/credits";

export type GeoTier = "T1" | "T2" | "T3";
export type { PackPriceId };
export { isPackPriceId };

const OFFICIAL_PACK_PRICES: Record<PackPriceId, number> = {
  starter: 20,
  pro: 40,
  creator: 60,
  business: 80,
  studio: 100,
};

/** Tier 3 — UZ + MDH (KZ bundan mustasno → T2) */
const TIER3_COUNTRIES = new Set([
  "UZ",
  "RU",
  "BY",
  "AM",
  "AZ",
  "KG",
  "TJ",
  "TM",
  "MD",
  "UA",
]);

/** Tier 2 — KZ, TR, AE, Sharqiy Yevropa */
const TIER2_COUNTRIES = new Set([
  "KZ",
  "TR",
  "AE",
  "PL",
  "CZ",
  "SK",
  "HU",
  "RO",
  "BG",
  "HR",
  "SI",
  "EE",
  "LV",
  "LT",
  "RS",
  "BA",
  "MK",
  "AL",
  "ME",
  "XK",
]);

/** Tier 1 — AQSh, G'arbiy Yevropa, SA, JP (+ yuqori DAR) */
const TIER1_COUNTRIES = new Set([
  "US",
  "CA",
  "GB",
  "IE",
  "DE",
  "FR",
  "IT",
  "ES",
  "NL",
  "BE",
  "AT",
  "CH",
  "SE",
  "NO",
  "DK",
  "FI",
  "PT",
  "GR",
  "LU",
  "IS",
  "SA",
  "JP",
  "AU",
  "NZ",
  "KR",
  "SG",
  "HK",
  "TW",
  "IL",
  "QA",
  "KW",
  "BH",
  "OM",
]);

const PACK_META: Record<
  PackPriceId,
  {
    name: string;
    coins: number;
    bonus: number;
    bonusPercent: number;
    tag: string;
    featured?: boolean;
    elite?: boolean;
  }
> = Object.fromEntries(
  COIN_PACKS.map((pack) => [
    pack.id,
    {
      name: pack.name,
      coins: pack.coins,
      bonus: pack.bonus,
      bonusPercent: pack.bonusPercent,
      tag: pack.tag,
      featured: pack.featured,
      elite: pack.elite,
    },
  ])
) as Record<
  PackPriceId,
  {
    name: string;
    coins: number;
    bonus: number;
    bonusPercent: number;
    tag: string;
    featured?: boolean;
    elite?: boolean;
  }
>;

export type PublicGeoPack = {
  id: PackPriceId;
  name: string;
  /** Faqat shu hudud narxi */
  price: number;
  priceFormatted: string;
  currency: string;
  currencySymbol: string;
  coins: number;
  bonus: number;
  bonusPercent: number;
  totalCoins: number;
  videoCapacity: number;
  tag: string;
  featured?: boolean;
  elite?: boolean;
};

export type SilentPricingPayload = {
  ok: true;
  /** Opaque — solishtirish uchun emas */
  regionToken: string;
  country: string;
  currency: string;
  currencySymbol: string;
  locale: string;
  termsKey: string;
  packs: PublicGeoPack[];
};

function normalizeCountry(code: string | null | undefined): string {
  if (!code) return "XX";
  const c = code.trim().toUpperCase();
  if (!c || c === "XX" || c === "T1" || c === "UNKNOWN") return "XX";
  return c.slice(0, 2);
}

/**
 * Cloudflare / Vercel / custom headers orqali mamlakat
 */
export function detectCountryFromHeaders(
  headers: Headers | Record<string, string | null | undefined>
): string {
  const get = (name: string) => {
    if (headers instanceof Headers) return headers.get(name);
    const key = Object.keys(headers).find(
      (k) => k.toLowerCase() === name.toLowerCase()
    );
    return key ? headers[key] ?? null : null;
  };

  const raw =
    get("x-alnabiy-geo-country") ||
    get("cf-ipcountry") ||
    get("CF-IPCountry") ||
    get("x-vercel-ip-country") ||
    get("x-country-code") ||
    get("x-geo-country") ||
    get("cloudfront-viewer-country") ||
    null;

  return normalizeCountry(raw);
}

export function detectCountryFromRequest(req: NextRequest): string {
  return detectCountryFromHeaders(req.headers);
}

/**
 * Noma'lum mamlakat → T1 (anti-fraud: yuqori narx)
 */
export function resolveGeoTier(countryCode: string): GeoTier {
  const c = normalizeCountry(countryCode);
  if (c !== "XX" && TIER3_COUNTRIES.has(c)) return "T3";
  if (c !== "XX" && TIER2_COUNTRIES.has(c)) return "T2";
  if (c !== "XX" && TIER1_COUNTRIES.has(c)) return "T1";
  // Aniqlanmagan / boshqa → Tier 1 (anti-fraud)
  return "T1";
}

/** Tierga ruxsat etilgan billing davlatlari (Stripe anti-fraud) */
export function allowedBillingCountries(tier: GeoTier): string[] {
  if (tier === "T3") return [...TIER3_COUNTRIES];
  if (tier === "T2") return [...TIER2_COUNTRIES];
  return [...TIER1_COUNTRIES];
}

export function isBillingCountryAllowed(
  tier: GeoTier,
  billingCountry: string | null | undefined
): boolean {
  const c = normalizeCountry(billingCountry);
  if (c === "XX") return false;
  // Soft allow: same tier OR listed
  const allowed = new Set(allowedBillingCountries(tier));
  if (allowed.has(c)) return true;
  // Cross-check: agar karta davlati boshqa tierda bo'lsa — rad
  const cardTier = resolveGeoTier(c);
  return cardTier === tier;
}

export function getPackPriceUsd(_tier: GeoTier, packId: PackPriceId): number {
  return OFFICIAL_PACK_PRICES[packId];
}

/** Locale → BCP47 + valyuta belgisi (ko'rsatish USD) */
export function localeToIntl(locale: string): {
  bcp47: string;
  currency: string;
  currencySymbol: string;
} {
  const map: Record<string, { bcp47: string; symbol: string }> = {
    uz: { bcp47: "uz-UZ", symbol: "$" },
    en: { bcp47: "en-US", symbol: "$" },
    ru: { bcp47: "ru-RU", symbol: "$" },
    fr: { bcp47: "fr-FR", symbol: "$" },
    ar: { bcp47: "ar-SA", symbol: "$" },
    es: { bcp47: "es-ES", symbol: "$" },
    de: { bcp47: "de-DE", symbol: "$" },
    tr: { bcp47: "tr-TR", symbol: "$" },
    zh: { bcp47: "zh-CN", symbol: "$" },
    ja: { bcp47: "ja-JP", symbol: "$" },
    ko: { bcp47: "ko-KR", symbol: "$" },
    hi: { bcp47: "hi-IN", symbol: "$" },
    pt: { bcp47: "pt-BR", symbol: "$" },
    it: { bcp47: "it-IT", symbol: "$" },
    id: { bcp47: "id-ID", symbol: "$" },
    ms: { bcp47: "ms-MY", symbol: "$" },
    fa: { bcp47: "fa-IR", symbol: "$" },
    uk: { bcp47: "uk-UA", symbol: "$" },
    pl: { bcp47: "pl-PL", symbol: "$" },
    nl: { bcp47: "nl-NL", symbol: "$" },
  };
  const entry = map[locale] || map.en;
  return {
    bcp47: entry.bcp47,
    currency: "USD",
    currencySymbol: entry.symbol,
  };
}

export function formatPriceForLocale(
  amountUsd: number,
  locale: string
): { formatted: string; currency: string; currencySymbol: string } {
  const { bcp47, currency, currencySymbol } = localeToIntl(locale);
  try {
    const formatted = new Intl.NumberFormat(bcp47, {
      style: "currency",
      currency,
      minimumFractionDigits: amountUsd % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amountUsd);
    return { formatted, currency, currencySymbol };
  } catch {
    return {
      formatted: `${currencySymbol}${amountUsd.toFixed(amountUsd % 1 ? 2 : 0)}`,
      currency,
      currencySymbol,
    };
  }
}

/**
 * Opaque region token — tier raqamini ochib bermaydi
 */
export function makeRegionToken(tier: GeoTier, country: string): string {
  const seed = `${tier}:${normalizeCountry(country)}:alnabiy`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return `rg_${Math.abs(h).toString(36)}`;
}

/**
 * Klientga faqat BITTA hudud paketlari — boshqa tier yo'q
 */
export function buildSilentPricing(opts: {
  country: string;
  locale: string;
}): SilentPricingPayload {
  const country = normalizeCountry(opts.country);
  const tier = resolveGeoTier(country);
  const { currency, currencySymbol } = localeToIntl(opts.locale);

  const packs: PublicGeoPack[] = (
    Object.keys(PACK_META) as PackPriceId[]
  ).map((id) => {
    const meta = PACK_META[id];
    const price = OFFICIAL_PACK_PRICES[id];
    const { formatted } = formatPriceForLocale(price, opts.locale);
    const totalCoins = meta.coins + meta.bonus;
    return {
      id,
      name: meta.name,
      price,
      priceFormatted: formatted,
      currency,
      currencySymbol,
      coins: meta.coins,
      bonus: meta.bonus,
      bonusPercent: meta.bonusPercent,
      totalCoins,
      videoCapacity: Math.floor(totalCoins / STANDARD_VIDEO_NC),
      tag: meta.tag,
      featured: meta.featured,
      elite: meta.elite,
    };
  });

  return {
    ok: true,
    regionToken: makeRegionToken(tier, country),
    country: country === "XX" ? "XX" : country,
    currency,
    currencySymbol,
    locale: opts.locale,
    termsKey: "geo_pricing_terms",
    packs,
  };
}

/**
 * Checkout uchun server-side narx qayta hisoblash (klient narxiga ishonilmaydi)
 */
export function resolveCheckoutQuote(opts: {
  packId: string;
  country: string;
}): {
  ok: boolean;
  tier?: GeoTier;
  packId?: PackPriceId;
  priceUsd?: number;
  amountCents?: number;
  coins?: number;
  bonus?: number;
  error?: string;
} {
  if (!isPackPriceId(opts.packId)) {
    return { ok: false, error: "Invalid pack" };
  }
  const tier = resolveGeoTier(opts.country);
  const priceUsd = getPackPriceUsd(tier, opts.packId);
  const meta = PACK_META[opts.packId];
  return {
    ok: true,
    tier,
    packId: opts.packId,
    priceUsd,
    amountCents: Math.round(priceUsd * 100),
    coins: meta.coins,
    bonus: meta.bonus,
  };
}
