import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  clientIp,
  rateLimitApi,
  rateLimitHeaders,
} from "@/lib/security/rate-limit-edge";
import { isAnalyzerUserAgent, hasAnalyzerHeaders } from "@/lib/waf";
import {
  SESSION_MAX_AGE_SEC,
  withPersistentCookieOptions,
} from "@/lib/auth/session-ttl";

/**
 * WAF + rate limit + Supabase session refresh (365-day persistent cookies).
 * Content-Security-Policy is applied via next.config.js headers (see src/lib/security/csp.ts).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const ua = request.headers.get("user-agent");
  if (
    pathname.startsWith("/api/") &&
    (isAnalyzerUserAgent(ua) || hasAnalyzerHeaders(request.headers))
  ) {
    return NextResponse.json(
      { ok: false, code: "WAF_BLOCKED", error: "Forbidden" },
      { status: 403 }
    );
  }

  if (pathname.startsWith("/api/")) {
    const skip =
      pathname.startsWith("/api/webhooks/") ||
      pathname.startsWith("/api/inngest") ||
      pathname.startsWith("/api/checkout/webhook") ||
      pathname.startsWith("/monitoring");

    if (!skip) {
      const id = clientIp(request);
      const limited = await rateLimitApi(id);
      if (!limited.success) {
        const unavailable = limited.source === "unavailable";
        return NextResponse.json(
          {
            ok: false,
            code: unavailable ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
            error: unavailable
              ? "Request protection is temporarily unavailable"
              : "Too many requests",
          },
          {
            status: unavailable ? 503 : 429,
            headers: {
              ...rateLimitHeaders(limited),
              "Retry-After": String(
                unavailable
                  ? 60
                  : Math.max(1, Math.ceil((limited.reset - Date.now()) / 1000))
              ),
            },
          }
        );
      }
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon || url.includes("[ref]")) {
    return supabaseResponse;
  }

  // Skip session refresh when there is no Supabase auth cookie — avoids
  // a remote getUser() round-trip on every cold navigation in local/dev.
  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      (c) =>
        c.name.includes("auth-token") ||
        c.name.startsWith("sb-") ||
        c.name.includes("supabase")
    );
  if (!hasAuthCookie) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anon, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_SEC,
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(
            name,
            value,
            withPersistentCookieOptions(options)
          )
        );
      },
    },
  });

  // Token refresh — cookie TTL qayta yoziladi (365 kun)
  await supabase.auth.getUser();
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
