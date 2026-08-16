import { NextRequest, NextResponse } from "next/server";
import {
  clientIp,
  rateLimitHeaders,
  rateLimitSensitive,
} from "@/lib/security/rate-limit";
import { isAnalyzerUserAgent, hasAnalyzerHeaders } from "@/lib/waf";

/**
 * Sensitive API endpoints uchun WAF + rate limit.
 */
export async function guardSensitiveRequest(
  req: NextRequest
): Promise<NextResponse | null> {
  const ua = req.headers.get("user-agent");
  if (isAnalyzerUserAgent(ua) || hasAnalyzerHeaders(req.headers)) {
    return NextResponse.json(
      { ok: false, code: "WAF_BLOCKED", error: "Request blocked" },
      { status: 403 }
    );
  }

  const ip = clientIp(req);
  const key =
    req.headers.get("x-alnabiy-key") ||
    ip;

  const limited = await rateLimitSensitive(key);
  if (!limited.success) {
    const unavailable = limited.source === "unavailable";
    return NextResponse.json(
      {
        ok: false,
        code: unavailable ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
        error: unavailable
          ? "Request protection is temporarily unavailable"
          : "Too many requests — try again shortly",
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

  return null;
}
