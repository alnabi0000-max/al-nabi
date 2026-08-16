import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createStatelessClient } from "@/lib/supabase/stateless";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { onboardNewUser } from "@/lib/auth/onboarding";
import { toSafePublicProfile } from "@/lib/auth/public-profile";
import { resolveAuthProvider } from "@/lib/auth/providers";
import { requireApiUser } from "@/lib/auth/api-guard";
import {
  rateLimitSensitive,
  clientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const schema = z.object({
  refreshToken: z.string().min(10).max(2048),
});

/**
 * Native (iOS / Android) session lifecycle.
 *
 * `GET`  — resolve the profile for the `Authorization: Bearer <access_token>`.
 * `POST` — exchange a refresh token for a fresh access/refresh pair.
 *
 * The web app never calls this: it relies on HTTP-only cookies refreshed by
 * the middleware.
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req);
  if ("response" in auth) return auth.response;

  return NextResponse.json(
    {
      ok: true,
      authenticated: true,
      source: auth.source,
      id: auth.user.id,
      email: auth.user.email,
      coins: auth.user.coins,
      referralCode: auth.user.referralCode,
      status: auth.user.status,
      role: auth.user.role,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitSensitive(`session-refresh:${clientIp(req)}`);
    if (!limited.success) {
      return NextResponse.json(
        { ok: false, code: "RATE_LIMITED", error: "Too many requests" },
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
        { ok: false, code: "INVALID_REFRESH_TOKEN", error: "Invalid request" },
        { status: 400 }
      );
    }

    const supabase = await createStatelessClient();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, code: "AUTH_UNAVAILABLE", error: "Auth unavailable" },
        { status: 503 }
      );
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: parsed.data.refreshToken,
    });

    if (error || !data.session || !data.user?.id || !data.user.email) {
      return NextResponse.json(
        { ok: false, code: "REFRESH_REJECTED", error: "Session expired" },
        { status: 401 }
      );
    }

    const { user } = await onboardNewUser(
      {
        id: data.user.id,
        email: data.user.email,
        name:
          (data.user.user_metadata?.full_name as string | undefined) || null,
        authProvider: resolveAuthProvider(data.user),
        touchLogin: false,
      },
      { source: "session_refresh", sendEmail: false }
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
        ...toSafePublicProfile(user),
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at ?? null,
          tokenType: "bearer",
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refresh failed";
    return NextResponse.json(
      { ok: false, code: "REFRESH_FAILED", error: msg },
      { status: 400 }
    );
  }
}
