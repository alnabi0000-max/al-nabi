import { NextResponse } from "next/server";
import { getAuthMode, isSupabaseConfigured } from "@/lib/auth/config";
import { getLocalSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { onboardNewUser } from "@/lib/auth/onboarding";
import { findUserByEmail } from "@/lib/auth/local-store";
import { toSafePublicProfile } from "@/lib/auth/public-profile";

/**
 * Joriy sessiya profili.
 * SEC-01: alnabiyKey / alnabiy_key hech qachon qaytmaydi.
 * Kalit faqat /api/auth/ensure yoki login orqali.
 */
export async function GET() {
  const mode = getAuthMode();

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        if (data.user?.email) {
          try {
            const { user: dbUser } = await onboardNewUser(
              {
                id: data.user.id,
                email: data.user.email,
                name: data.user.user_metadata?.full_name as string | undefined,
              },
              { source: "session_me", sendEmail: true }
            );
            return NextResponse.json({
              ok: true,
              mode: "supabase",
              authenticated: true,
              ...toSafePublicProfile(dbUser),
            });
          } catch {
            const local = findUserByEmail(data.user.email);
            if (local) {
              return NextResponse.json({
                ok: true,
                mode: "supabase",
                authenticated: true,
                ...toSafePublicProfile(local),
              });
            }
          }
        }
      }
    } catch {
      /* fall through */
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
      }),
    });
  }

  return NextResponse.json({
    ok: true,
    mode,
    authenticated: false,
  });
}
