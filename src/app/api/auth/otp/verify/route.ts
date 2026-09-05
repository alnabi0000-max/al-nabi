import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { createStatelessClient } from "@/lib/supabase/stateless";
import { createRouteHandlerClient } from "@/lib/supabase/route-client";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { onboardNewUser } from "@/lib/auth/onboarding";
import { toSafePublicProfile } from "@/lib/auth/public-profile";
import {
  rateLimitSensitive,
  clientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().email().max(254),
  token: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
  /** `mobile` returns tokens in the body; `web` stores them in HTTP-only cookies. */
  platform: z.enum(["web", "mobile"]).default("web"),
});

function jsonError(
  error: string,
  status: number,
  code: string,
  extra?: HeadersInit
) {
  return NextResponse.json(
    { ok: false, code, error },
    { status, headers: extra }
  );
}

/**
 * Verify a 6-digit email code and open a session.
 *
 * Web clients receive HTTP-only Supabase cookies via `applyCookies` — the
 * same path email/password login uses. `cookies().set()` can be a no-op in
 * this handler, so the route client must copy Set-Cookie onto the response.
 * Native clients opt in with `platform: "mobile"` and receive the
 * access/refresh pair to hold in secure device storage.
 */
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitSensitive(`otp-verify:${clientIp(req)}`);
    if (!limited.success) {
      return jsonError(
        "Too many attempts",
        429,
        "RATE_LIMITED",
        rateLimitHeaders(limited)
      );
    }

    if (!isSupabaseConfigured()) {
      return jsonError("Auth unavailable", 503, "SUPABASE_REQUIRED");
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Enter the 6-digit code", 400, "INVALID_CODE");
    }
    const { email, token, platform } = parsed.data;

    let identity: SupabaseUser;
    let session: Session | null = null;
    let applyCookies: (<T extends NextResponse>(response: T) => T) | null =
      null;

    if (platform === "mobile") {
      const supabase = await createStatelessClient();
      if (!supabase) {
        return jsonError("Auth unavailable", 503, "AUTH_UNAVAILABLE");
      }
      const verified = await supabase.auth.verifyOtp({
        email: email.toLowerCase(),
        token,
        type: "email",
      });
      if (verified.error || !verified.data.user?.id) {
        return jsonError(
          "Code is invalid or expired",
          401,
          "OTP_INVALID",
          rateLimitHeaders(limited)
        );
      }
      identity = verified.data.user;
      session = verified.data.session;
    } else {
      const route = createRouteHandlerClient(req);
      if (!route) {
        return jsonError("Auth unavailable", 503, "AUTH_UNAVAILABLE");
      }
      applyCookies = route.applyCookies;
      const verified = await route.supabase.auth.verifyOtp({
        email: email.toLowerCase(),
        token,
        type: "email",
      });
      if (verified.error || !verified.data.user?.id) {
        return route.applyCookies(
          jsonError(
            "Code is invalid or expired",
            401,
            "OTP_INVALID",
            rateLimitHeaders(limited)
          )
        );
      }
      identity = verified.data.user;
      session = verified.data.session;
    }

    const { user } = await onboardNewUser(
      {
        id: identity.id,
        email: identity.email || email.toLowerCase(),
        name:
          (identity.user_metadata?.full_name as string | undefined) ||
          (identity.user_metadata?.name as string | undefined) ||
          null,
        authProvider: "EMAIL_OTP",
      },
      { source: "email_otp", sendEmail: true }
    );

    if (user.status === "BANNED") {
      const banned = NextResponse.json(
        { ok: false, authenticated: false, code: "ACCOUNT_BANNED" },
        { status: 403 }
      );
      return applyCookies ? applyCookies(banned) : banned;
    }

    const body = NextResponse.json(
      {
        ok: true,
        authenticated: true,
        mode: "supabase",
        ...toSafePublicProfile(user),
        ...(platform === "mobile" && session
          ? {
              session: {
                accessToken: session.access_token,
                refreshToken: session.refresh_token,
                expiresAt: session.expires_at ?? null,
                tokenType: "bearer",
              },
            }
          : {}),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
    return applyCookies ? applyCookies(body) : body;
  } catch {
    return jsonError("Verification failed", 400, "OTP_VERIFY_FAILED");
  }
}
