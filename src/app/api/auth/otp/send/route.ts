import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createStatelessClient } from "@/lib/supabase/stateless";
import { isSupabaseConfigured } from "@/lib/auth/config";
import {
  rateLimitSensitive,
  clientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().email().max(254),
});

/**
 * Passwordless 6-digit email code.
 *
 * Uses the same Supabase OTP grant as the magic link but omits
 * `emailRedirectTo`, so the delivered mail is the code template rather than a
 * clickable link. Requires `{{ .Token }}` in the Supabase "Magic Link" email
 * template.
 */
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitSensitive(`otp-send:${clientIp(req)}`);
    if (!limited.success) {
      return NextResponse.json(
        { ok: false, code: "RATE_LIMITED", error: "Too many requests" },
        { status: 429, headers: rateLimitHeaders(limited) }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          code: "SUPABASE_REQUIRED",
          error:
            "Email kod uchun Supabase sozlang (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)",
        },
        { status: 503 }
      );
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, code: "INVALID_EMAIL", error: "Invalid email" },
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

    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email.toLowerCase(),
      options: { shouldCreateUser: true },
    });

    if (error) {
      return NextResponse.json(
        { ok: false, code: "OTP_SEND_FAILED", error: "Could not send code" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      // Supabase default; surfaced so the UI can render an accurate countdown.
      expiresInSec: 3600,
      message: "Code sent — check your email",
    });
  } catch {
    return NextResponse.json(
      { ok: false, code: "OTP_SEND_FAILED", error: "Could not send code" },
      { status: 400 }
    );
  }
}
