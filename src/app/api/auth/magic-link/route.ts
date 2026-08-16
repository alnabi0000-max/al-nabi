import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { rateLimitSensitive, clientIp, rateLimitHeaders } from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().email().max(254),
  next: z.string().optional(),
  /** `mobile` sends the user back through the app's deep link. */
  platform: z.enum(["web", "mobile"]).default("web"),
});

/**
 * Parolsiz Magic Link — emailga bir martalik havola.
 *
 * Web links land on `/auth/callback`, which exchanges the code for HTTP-only
 * cookies. Mobile links land on the same route with `platform=mobile`, which
 * forwards the code to `alnabi://auth/callback` for the app to exchange.
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
          error:
            "Magic Link uchun Supabase sozlang (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)",
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

    /* Never trust request Origin/Host for the email redirect base in
     * production — an attacker-controlled Host header could redirect the
     * magic-link click to an off-site phishing page. */
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NODE_ENV === "production"
        ? null
        : req.headers.get("origin") ||
          `${req.nextUrl.protocol}//${req.nextUrl.host}`);
    if (!origin) {
      return NextResponse.json(
        { ok: false, error: "NEXT_PUBLIC_APP_URL must be configured" },
        { status: 503 }
      );
    }
    const rawNext = body.next || "/profile?tab=kabinet";
    const next = /^\/(?!\/)[a-zA-Z0-9/_?&=%.-]*$/.test(rawNext)
      ? rawNext
      : "/profile?tab=kabinet";

    const callback = new URL(`${origin}/auth/callback`);
    callback.searchParams.set("next", next);
    if (body.platform === "mobile") {
      callback.searchParams.set("platform", "mobile");
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: body.email.toLowerCase(),
      options: {
        emailRedirectTo: callback.toString(),
        shouldCreateUser: true,
      },
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Magic link sent — check your email",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Magic link failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
