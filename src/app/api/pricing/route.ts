import { NextRequest, NextResponse } from "next/server";
import {
  buildSilentPricing,
  detectCountryFromRequest,
} from "@/lib/geo";
import { resolveLocale } from "@/lib/i18n/messages";

/**
 * GET — official fixed NC packages ($20–$100).
 * Geo headers stay for checkout fraud controls only.
 */
export async function GET(req: NextRequest) {
  const country = detectCountryFromRequest(req);
  const localeParam =
    req.nextUrl.searchParams.get("locale") ||
    req.headers.get("x-alnabiy-locale") ||
    req.cookies.get("alnabiy_locale")?.value ||
    "en";
  const locale = resolveLocale(localeParam);

  const payload = buildSilentPricing({ country, locale });

  const res = NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, no-store, no-cache",
      "Vary": "CF-IPCountry, X-Vercel-IP-Country, Cookie",
      "X-Alnabiy-Geo-Lock": "strict",
    },
  });
  return res;
}
