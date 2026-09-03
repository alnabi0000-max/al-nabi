import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createStatelessClient } from "@/lib/supabase/stateless";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { onboardNewUser } from "@/lib/auth/onboarding";
import { extractSupabaseIdentity } from "@/lib/auth/identity";
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

/**
 * Verify a 6-digit email code and open a session.
 *
 * Web clients receive HTTP-only Supabase cookies and no token material in the
 * response body. Native clients opt in with `platform: "mobile"` and receive
 * the access/refresh pair to hold in secure device storage.
 */
export async function POST(req: NextRequest) {
  try {
    // A 6-digit code is brute-forceable, so throttle before touching Supabase.
    const limited = await rateLimitSensitive(`otp-verify:${clientIp(req)}`);
    if (!limited.success) {
      return NextResponse.json(
        { ok: false, code: "RATE_LIMITED", error: "Too many attempts" },
        { status: 429, headers: rateLimitHeaders(limited) }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { ok: false, code: "SUPABASE_REQUIRED", error: "Auth unavailable" },
        { status: 503 }
      );
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, code: "INVALID_CODE", error: "Enter the 6-digit code" },
        { status: 400 }
      );
    }
    const { email, token, platform } = parsed.data;

    const supabase =
      platform === "mobile"
        ? await createStatelessClient()
        : await createClient();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, code: "AUTH_UNAVAILABLE", error: "Auth unavailable" },
        { status: 503 }
      );
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase(),
      token,
      type: "email",
    });

    if (error || !data.user?.id) {
      return NextResponse.json(
        {
          ok: false,
          code: "OTP_INVALID",
          error: error?.message || "Code is invalid or expired",
        },
        { status: 401, headers: rateLimitHeaders(limited) }
      );
    }

    const extracted = extractSupabaseIdentity(data.user);
    const { user } = await onboardNewUser(
      {
        id: data.user.id,
        email:
          extracted?.email && !extracted.email.endsWith("@users.alnabiy.local")
            ? extracted.email
            : email.toLowerCase(),
        name: extracted?.name || null,
        avatarUrl: extracted?.avatarUrl || null,
        authProvider: "EMAIL_OTP",
      },
      { source: "email_otp", sendEmail: true }
    );

    if (user.status === "BANNED") {
      return NextResponse.json(
        { ok: false, authenticated: false, code: "ACCOUNT_BANNED" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        authenticated: true,
        mode: "supabase",
        ...toSafePublicProfile(user),
        ...(platform === "mobile" && data.session
          ? {
              session: {
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token,
                expiresAt: data.session.expires_at ?? null,
                tokenType: "bearer",
              },
            }
          : {}),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verification failed";
    return NextResponse.json(
      { ok: false, code: "OTP_VERIFY_FAILED", error: msg },
      { status: 400 }
    );
  }
}
