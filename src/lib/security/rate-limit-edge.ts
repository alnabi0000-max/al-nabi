/**
 * Edge-safe distributed rate limiting for middleware.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  source: "upstash" | "memory" | "unavailable";
};

type MemoryBucket = { count: number; resetAt: number };

const memory = new Map<string, MemoryBucket>();
const isProductionRuntime = () => process.env.NODE_ENV === "production";

function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function unavailableLimit(): RateLimitResult {
  return {
    success: false,
    limit: 0,
    remaining: 0,
    reset: Date.now() + 60_000,
    source: "unavailable",
  };
}

function memoryLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucket = memory.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: now + windowMs,
      source: "memory",
    };
  }
  bucket.count += 1;
  return {
    success: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    reset: bucket.resetAt,
    source: "memory",
  };
}

let apiLimiter: Ratelimit | null = null;

function getApiLimiter(): Ratelimit | null {
  if (!isUpstashConfigured()) return null;
  apiLimiter ||= new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(120, "1 m"),
    prefix: "alnabiy:edge-api",
    analytics: true,
  });
  return apiLimiter;
}

export function clientIp(req: { headers: Headers }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "anon"
  );
}

/** Middleware: 120 req / minut / IP */
export async function rateLimitApi(
  identifier: string
): Promise<RateLimitResult> {
  try {
    const limiter = getApiLimiter();
    if (!limiter) {
      return isProductionRuntime()
        ? unavailableLimit()
        : memoryLimit(`api:${identifier}`, 120, 60_000);
    }
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      source: "upstash",
    };
  } catch (error) {
    console.error("[Alnabiy] Upstash edge rate limit failed", error);
    return isProductionRuntime()
      ? unavailableLimit()
      : memoryLimit(`api:${identifier}`, 120, 60_000);
  }
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
    "X-RateLimit-Source": result.source,
  };
}
