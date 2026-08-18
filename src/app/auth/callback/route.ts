import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { onboardNewUser } from "@/lib/auth/onboarding";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { resolveAuthProvider } from "@/lib/auth/providers";
import {
  appendDeepLinkParams,
  isMobilePlatform,
  mobileCallbackUrl,
  safeMobileRedirect,
} from "@/lib/auth/deep-link";

/**
 * OAuth / Magic Link / recovery callback → onboard + redirect.
 *
 * Native clients (`?platform=mobile` or `?redirect_to=alnabi://auth/callback`)
 * get the authorization code forwarded to the app's custom scheme instead: the
 * PKCE verifier lives on the device, so only the app can complete the
 * exchange.
 */

/** Only allow same-site relative paths — blocks `//evil.com`, `https://evil.com`, `\\evil.com`. */
function safeNextPath(raw: string | null): string {
  if (!raw) return "/";
  if (!/^\/(?!\/)[a-zA-Z0-9/_?&=%.-]*$/.test(raw)) return "/";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const wantsMobile =
    isMobilePlatform(searchParams.get("platform")) ||
    Boolean(safeMobileRedirect(searchParams.get("redirect_to")));

  if (wantsMobile) {
    const target =
      safeMobileRedirect(searchParams.get("redirect_to")) || mobileCallbackUrl();
    return NextResponse.redirect(
      appendDeepLinkParams(target, {
        code,
        next: searchParams.get("next"),
        error: code ? null : searchParams.get("error") || "missing_code",
        error_description: searchParams.get("error_description"),
      })
    );
  }

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
            authProvider: resolveAuthProvider(data.user),
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
