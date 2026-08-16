import { NextRequest, NextResponse } from "next/server";
import { getAuthMode } from "@/lib/auth/config";
import { getLocalSessionUser } from "@/lib/auth/session";
import { ensureRequestLedgerUser } from "@/lib/auth/ensure-request-user";
import { toSafePublicProfile } from "@/lib/auth/public-profile";

/**
 * Joriy sessiya profili — cookie (web) yoki Bearer token (mobil).
 * SEC-01: alnabiyKey / alnabiy_key hech qachon qaytmaydi.
 * Production auth endpoints never expose a reusable bearer key.
 */
export async function GET(req: NextRequest) {
  const mode = getAuthMode();

  if (mode === "supabase") {
    try {
      const ensured = await ensureRequestLedgerUser({
        request: req,
        allowGuest: false,
      });

      if (!ensured) {
        return NextResponse.json(
          { ok: true, mode, authenticated: false },
          { headers: { "Cache-Control": "no-store" } }
        );
      }

      if (ensured.user.status === "BANNED") {
        return NextResponse.json(
          { ok: false, authenticated: false, code: "ACCOUNT_BANNED" },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          mode,
          authenticated: true,
          source: ensured.source,
          ...toSafePublicProfile(ensured.user),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch {
      return NextResponse.json(
        { ok: false, code: "AUTH_UNAVAILABLE", error: "Auth unavailable" },
        { status: 503 }
      );
    }
  }

  const local = await getLocalSessionUser();
  if (local) {
    return NextResponse.json({
      ok: true,
      mode: "local",
      authenticated: true,
      ...toSafePublicProfile({
        id: local.id,
        email: local.email,
        coins: local.coins,
        referralCode: local.referralCode,
        status: local.status,
        authProvider: "LOCAL",
      }),
    });
  }

  return NextResponse.json({
    ok: true,
    mode,
    authenticated: false,
  });
}
