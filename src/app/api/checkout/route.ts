import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe/checkout-session";
import { detectCountryFromRequest } from "@/lib/geo";
import { resolveLocale } from "@/lib/i18n/messages";
import { guardSensitiveRequest } from "@/lib/security/request-guard";

/**
 * Legacy alias → create-session
 */
export async function POST(req: NextRequest) {
  try {
    const blocked = await guardSensitiveRequest(req);
    if (blocked) return blocked;
    return await createCheckoutSession(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { buildSilentPricing } = await import("@/lib/geo");
  const country = detectCountryFromRequest(req);
  const locale = resolveLocale(
    req.nextUrl.searchParams.get("locale") ||
      req.headers.get("x-alnabiy-locale") ||
      req.cookies.get("alnabiy_locale")?.value ||
      "en"
  );
  return NextResponse.json(buildSilentPricing({ country, locale }), {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Alnabiy-Geo-Lock": "strict",
    },
  });
}
