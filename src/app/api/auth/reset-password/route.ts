import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { publicAppOriginFromRequest } from "@/lib/auth/oauth-origin";
import {
  rateLimitSensitive,
  clientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().email(),
});

/**
 * Parolni tiklash — Supabase recovery email (in-app popupdan).
 */
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitSensitive(clientIp(req));
    if (!limited.success) {
      return NextResponse.json(
        { ok: false, error: "Too many requests" },
        { status: 429, headers: rateLimitHeaders(limited) }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          code: "SUPABASE_REQUIRED",
          error: "Password recovery requires Supabase Auth",
        },
        { status: 503 }
      );
    }

    const body = schema.parse(await req.json());
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Auth unavailable" },
        { status: 503 }
      );
    }

    const origin = publicAppOriginFromRequest(req);
    if (!origin) {
      return NextResponse.json(
        { ok: false, error: "NEXT_PUBLIC_APP_URL must be configured" },
        { status: 503 }
      );
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      body.email.toLowerCase(),
      {
        redirectTo: `${origin}/auth/reset`,
      }
    );

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Password reset link sent — check your email",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Reset failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
