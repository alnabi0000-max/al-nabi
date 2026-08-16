import { NextResponse } from "next/server";
import { getAuthMode } from "@/lib/auth/config";
import { getLocalSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { onboardNewUser } from "@/lib/auth/onboarding";
import { toSafePublicProfile } from "@/lib/auth/public-profile";

/**
 * Joriy sessiya profili.
 * SEC-01: alnabiyKey / alnabiy_key hech qachon qaytmaydi.
 * Production auth endpoints never expose a reusable bearer key.
 */
export async function GET() {
  const mode = getAuthMode();

  if (mode === "supabase") {
    try {
      const supabase = await createClient();
      if (!supabase) {
        return NextResponse.json(
          { ok: false, code: "AUTH_UNAVAILABLE", error: "Auth unavailable" },
          { status: 503 }
        );
      }

      const { data, error } = await supabase.auth.getUser();
      if (error) {
        return NextResponse.json(
          { ok: false, code: "AUTH_UNAVAILABLE", error: "Auth unavailable" },
          { status: 503 }
        );
      }

      if (data.user?.email) {
        const { user: dbUser } = await onboardNewUser(
          {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.full_name as string | undefined,
          },
          { source: "session_me", sendEmail: true }
        );
        if (dbUser.status === "BANNED") {
          return NextResponse.json(
            { ok: false, authenticated: false, code: "ACCOUNT_BANNED" },
            { status: 403 }
          );
        }
        return NextResponse.json({
          ok: true,
          mode,
          authenticated: true,
          ...toSafePublicProfile(dbUser),
        });
      }
    } catch {
      return NextResponse.json(
        { ok: false, code: "AUTH_UNAVAILABLE", error: "Auth unavailable" },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, mode, authenticated: false });
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
      }),
    });
  }

  return NextResponse.json({
    ok: true,
    mode,
    authenticated: false,
  });
}
