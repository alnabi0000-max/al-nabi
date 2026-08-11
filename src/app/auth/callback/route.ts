import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { onboardNewUser } from "@/lib/auth/onboarding";
import { isSupabaseConfigured } from "@/lib/auth/config";

/**
 * OAuth / Magic Link / recovery callback → onboard + redirect
 */
/** Only allow same-site relative paths — blocks `//evil.com`, `https://evil.com`, `\\evil.com`. */
function safeNextPath(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!/^\/(?!\/)[a-zA-Z0-9/_?&=%.-]*$/.test(raw)) return "/dashboard";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/profile?auth=local`);
  }

  if (code) {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.redirect(`${origin}/profile?auth=error`);
    }
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      try {
        await onboardNewUser(
          {
            id: data.user.id,
            email: data.user.email || `${data.user.id}@users.alnabiy.local`,
            name:
              (data.user.user_metadata?.full_name as string | undefined) ||
              (data.user.user_metadata?.name as string | undefined) ||
              null,
          },
          { source: "auth_callback", sendEmail: true }
        );
      } catch (e) {
        console.warn("[Alnabiy] onboardNewUser failed", e);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/profile?auth=error`);
}
