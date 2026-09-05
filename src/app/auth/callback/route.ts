import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-client";
import { onboardNewUser } from "@/lib/auth/onboarding";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { resolveAuthProvider } from "@/lib/auth/providers";
import {
  publicAppOriginFromRequest,
  safeOAuthNextPath,
} from "@/lib/auth/oauth-origin";
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
 *
 * Web clients must copy session cookies onto the redirect response. Next.js 15
 * `cookies().set()` can be a no-op here; `createRouteHandlerClient` attaches
 * Set-Cookie the same way email/password login does.
 */

/** Only allow same-site relative paths — blocks `//evil.com`, `https://evil.com`. */
function safeNextPath(raw: string | null): string {
  return safeOAuthNextPath(raw);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = publicAppOriginFromRequest(request);
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

  if (!code) {
    console.warn("[Alnabiy] auth callback missing code", {
      error: searchParams.get("error"),
      errorDescription: searchParams.get("error_description"),
    });
    return NextResponse.redirect(`${origin}/profile?auth=error`);
  }

  const route = createRouteHandlerClient(request);
  if (!route) {
    console.warn("[Alnabiy] auth callback: route client unavailable");
    return NextResponse.redirect(`${origin}/profile?auth=error`);
  }

  const { data, error } = await route.supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.warn("[Alnabiy] exchangeCodeForSession failed", error);
    return route.applyCookies(
      NextResponse.redirect(`${origin}/profile?auth=error`)
    );
  }

  const identity = {
    id: data.user.id,
    email: data.user.email || `${data.user.id}@users.alnabiy.local`,
    name:
      (data.user.user_metadata?.full_name as string | undefined) ||
      (data.user.user_metadata?.name as string | undefined) ||
      null,
    authProvider: resolveAuthProvider(data.user),
  };

  try {
    await onboardNewUser(identity, {
      source: "auth_callback",
      sendEmail: true,
    });
  } catch (e) {
    console.warn("[Alnabiy] onboardNewUser failed", e);
    try {
      await onboardNewUser(identity, {
        source: "auth_callback_retry",
        sendEmail: false,
      });
    } catch (retry) {
      console.warn("[Alnabiy] onboardNewUser retry failed", retry);
    }
  }

  return route.applyCookies(NextResponse.redirect(`${origin}${next}`));
}
