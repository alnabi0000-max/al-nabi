import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  source: "upstash" | "memory";
};

type MemoryBucket = { count: number; resetAt: number };

const memory = new Map<string, MemoryBucket>();

function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
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
  const success = bucket.count <= limit;
  return {
    success,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    reset: bucket.resetAt,
    source: "memory",
  };
}

let apiLimiter: Ratelimit | null = null;
let genLimiter: Ratelimit | null = null;

function getApiLimiter(): Ratelimit | null {
  if (!isUpstashConfigured()) return null;
  if (!apiLimiter) {
    apiLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(120, "1 m"),
      prefix: "alnabiy:api",
      analytics: true,
    });
  }
  return apiLimiter;
}

function getGenLimiter(): Ratelimit | null {
  if (!isUpstashConfigured()) return null;
  if (!genLimiter) {
    genLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      prefix: "alnabiy:gen",
      analytics: true,
    });
  }
  return genLimiter;
}

export function clientIp(req: {
  headers: Headers;
}): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "anon"
  );
}

/**
 * Umumiy API rate limit (middleware).
 * Upstash yo‘q bo‘lsa — process memory fallback.
 */
export async function rateLimitApi(
  identifier: string
): Promise<RateLimitResult> {
  const limiter = getApiLimiter();
  if (!limiter) {
    return memoryLimit(`api:${identifier}`, 120, 60_000);
  }
  const res = await limiter.limit(identifier);
  return {
    success: res.success,
    limit: res.limit,
    remaining: res.remaining,
    reset: res.reset,
    source: "upstash",
  };
}

/**
 * Generate / checkout uchun qattiqroq limit.
 */
export async function rateLimitSensitive(
  identifier: string
): Promise<RateLimitResult> {
  const limiter = getGenLimiter();
  if (!limiter) {
    return memoryLimit(`gen:${identifier}`, 20, 60_000);
  }
  const res = await limiter.limit(identifier);
  return {
    success: res.success,
    limit: res.limit,
    remaining: res.remaining,
    reset: res.reset,
    source: "upstash",
  };
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
    "X-RateLimit-Source": result.source,
  };
}
