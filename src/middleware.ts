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
import { inspectAccessToken } from "@/lib/auth/jwt";
import { requiresSessionToken } from "@/lib/auth/protected-routes";
import { isPlaceholderEnvValue } from "@/lib/env";
import { isAdminUiPath } from "@/lib/admin/gate-path";
import {
  ADMIN_GATE_COOKIE,
  verifyAdminGateToken,
} from "@/lib/admin/gate-token";

/**
 * WAF + rate limit + fail-closed session gate + Supabase session refresh
 * (365-day persistent cookies).
 *
 * The session gate denies every protected `/api/*` request that cannot present
 * a live Supabase session — as HTTP-only cookies (web) or as a JWT bearer
 * token (native iOS / Android). Route handlers still run their own
 * `ensureRequestLedgerUser()` check; this layer exists so a handler that
 * forgets to do so is never reachable anonymously.
 *
 * Content-Security-Policy is applied via next.config.js headers
 * (see src/lib/security/csp.ts).
 */

function denyUnauthenticated(reason: string) {
  return NextResponse.json(
    {
      ok: false,
      authenticated: false,
      code: "AUTH_REQUIRED",
      error: "Sign in required",
      reason,
    },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}

function readBearer(request: NextRequest): string | null {
  const raw = request.headers.get("authorization");
  if (!raw) return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match?.[1]?.trim() || null;
}

/**
 * Mirrors `getAuthMode()` without importing it: that module asserts its
 * production configuration at import time, and a missing server variable in
 * the Edge runtime would take down every request rather than a single route.
 */
function edgeAuthMode(supabaseConfigured: boolean): "local" | "supabase" {
  if (process.env.NODE_ENV === "production") return "supabase";
  const forced = process.env.AUTH_MODE?.trim().toLowerCase();
  if (forced === "local") return "local";
  if (forced === "supabase") return "supabase";
  return supabaseConfigured ? "supabase" : "local";
}

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      (c) =>
        c.name.includes("auth-token") ||
        c.name.startsWith("sb-") ||
        c.name.includes("supabase")
    );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminUiPath(pathname)) {
    const gate = request.cookies.get(ADMIN_GATE_COOKIE)?.value;
    if (!(await verifyAdminGateToken(gate))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

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
  const supabaseEnabled = Boolean(
    url &&
      anon &&
      !isPlaceholderEnvValue(url) &&
      !isPlaceholderEnvValue(anon)
  );

  // Local development on the file-backed auth store keeps its guest bypass:
  // the route-level guard owns that decision. Production always resolves to
  // `supabase`, and `getAuthMode()` refuses to boot if it is misconfigured, so
  // no request can slip past this gate unauthenticated.
  const gated =
    supabaseEnabled &&
    edgeAuthMode(supabaseEnabled) === "supabase" &&
    requiresSessionToken(pathname);

  const bearer = readBearer(request);
  if (bearer) {
    // A bearer token is an explicit identity claim: reject it here when it is
    // malformed or expired instead of letting it fall back to cookies.
    const inspection = await inspectAccessToken(bearer);
    if (!inspection.valid) {
      return gated ? denyUnauthenticated(inspection.reason) : supabaseResponse;
    }
    // Signature/session validity is confirmed by the route handler's
    // getUser() call against the Supabase Auth server.
    return supabaseResponse;
  }

  if (!supabaseEnabled) {
    return supabaseResponse;
  }

  // Skip session refresh when there is no Supabase auth cookie — avoids
  // a remote getUser() round-trip on every cold navigation in local/dev.
  if (!hasSupabaseAuthCookie(request)) {
    return gated ? denyUnauthenticated("missing_session") : supabaseResponse;
  }

  const supabase = createServerClient(url!, anon!, {
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
  const { data, error } = await supabase.auth.getUser();
  if (gated && (error || !data.user)) {
    return denyUnauthenticated("invalid_session");
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
