import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { onboardNewUser } from "@/lib/auth/onboarding";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { EmailAlreadyRegisteredError } from "@/lib/auth/ensure-user";
import { extractSupabaseIdentity } from "@/lib/auth/identity";
import {
  OAUTH_ERROR_PATH,
  OAUTH_NEXT_COOKIE,
  appendAuthQuery,
  readOAuthNextFromCookieHeader,
  safeNextPath,
} from "@/lib/auth/oauth-redirect";
import {
  type OAuthErrorReason,
  normalizeOAuthProviderError,
} from "@/lib/auth/oauth-errors";
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
 * Web Google sign-in lands on the clean `/auth/callback` URL (allow-list
 * safe). The intended in-app path is read from `?next=` or the short-lived
 * `alnabiy_oauth_next` cookie.
 */

function fail(
  origin: string,
  reason: OAuthErrorReason,
  extra?: { clearNext?: boolean }
): NextResponse {
  const res = NextResponse.redirect(
    `${origin}${appendAuthQuery(OAUTH_ERROR_PATH, "error", reason)}`
  );
  if (extra?.clearNext !== false) {
    res.cookies.set(OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return res;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");
  const providerDescription = searchParams.get("error_description");
  const cookieNext = readOAuthNextFromCookieHeader(
    request.headers.get("cookie")
  );
  const next = safeNextPath(searchParams.get("next") || cookieNext);

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
    const res = NextResponse.redirect(
      `${origin}${appendAuthQuery(OAUTH_ERROR_PATH, "local", "supabase_required")}`
    );
    res.cookies.set(OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  if (providerError) {
    return fail(
      origin,
      normalizeOAuthProviderError(providerError, providerDescription)
    );
  }

  if (!code) {
    return fail(origin, "missing_code");
  }

  const supabase = await createClient();
  if (!supabase) {
    return fail(origin, "supabase_required");
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.warn("[Alnabiy] OAuth exchange failed", error?.message);
    return fail(
      origin,
      normalizeOAuthProviderError(error?.message, error?.message)
    );
  }

  const identity = extractSupabaseIdentity(data.user);
  if (!identity) {
    return fail(origin, "identity_failed");
  }

  try {
    await onboardNewUser(identity, {
      source: "auth_callback",
      sendEmail: true,
    });
  } catch (e) {
    console.warn("[Alnabiy] onboardNewUser failed", e);
    if (e instanceof EmailAlreadyRegisteredError) {
      try {
        await supabase.auth.signOut();
      } catch {
        /* session cookies are cleared on the error redirect below */
      }
      return fail(origin, "email_taken");
    }
    return fail(origin, "identity_failed");
  }

  const res = NextResponse.redirect(
    `${origin}${appendAuthQuery(next, "ok")}`
  );
  res.cookies.set(OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
