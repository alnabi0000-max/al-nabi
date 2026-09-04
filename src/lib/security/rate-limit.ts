import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isUpstashConfigured } from "@/lib/security/upstash-config";

export { isUpstashConfigured } from "@/lib/security/upstash-config";

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
let unlockLimiter: Ratelimit | null = null;
let userGenLimiter: Ratelimit | null = null;

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

function getUserGenLimiter(): Ratelimit | null {
  if (!isUpstashConfigured()) return null;
  if (!userGenLimiter) {
    userGenLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "alnabiy:gen-user",
      analytics: true,
    });
  }
  return userGenLimiter;
}

function getUnlockLimiter(): Ratelimit | null {
  if (!isUpstashConfigured()) return null;
  if (!unlockLimiter) {
    unlockLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      prefix: "alnabiy:admin-unlock",
      analytics: true,
    });
  }
  return unlockLimiter;
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
 * Development can use process memory; production requires Upstash.
 */
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
    const res = await limiter.limit(identifier);
    return {
      success: res.success,
      limit: res.limit,
      remaining: res.remaining,
      reset: res.reset,
      source: "upstash",
    };
  } catch (error) {
    console.error("[Alnabiy] Upstash API rate limit failed", error);
    return isProductionRuntime()
      ? unavailableLimit()
      : memoryLimit(`api:${identifier}`, 120, 60_000);
  }
}

/**
 * Generate / checkout uchun qattiqroq limit.
 */
export async function rateLimitSensitive(
  identifier: string
): Promise<RateLimitResult> {
  try {
    const limiter = getGenLimiter();
    if (!limiter) {
      return isProductionRuntime()
        ? unavailableLimit()
        : memoryLimit(`gen:${identifier}`, 20, 60_000);
    }
    const res = await limiter.limit(identifier);
    return {
      success: res.success,
      limit: res.limit,
      remaining: res.remaining,
      reset: res.reset,
      source: "upstash",
    };
  } catch (error) {
    console.error("[Alnabiy] Upstash sensitive rate limit failed", error);
    return isProductionRuntime()
      ? unavailableLimit()
      : memoryLimit(`gen:${identifier}`, 20, 60_000);
  }
}

/**
 * Hidden admin unlock — 5 attempts / 15 minutes / IP.
 */
export async function rateLimitUnlock(
  identifier: string
): Promise<RateLimitResult> {
  try {
    const limiter = getUnlockLimiter();
    if (!limiter) {
      return isProductionRuntime()
        ? unavailableLimit()
        : memoryLimit(`unlock:${identifier}`, 5, 15 * 60_000);
    }
    const res = await limiter.limit(identifier);
    return {
      success: res.success,
      limit: res.limit,
      remaining: res.remaining,
      reset: res.reset,
      source: "upstash",
    };
  } catch (error) {
    console.error("[Alnabiy] Upstash admin-unlock rate limit failed", error);
    return isProductionRuntime()
      ? unavailableLimit()
      : memoryLimit(`unlock:${identifier}`, 5, 15 * 60_000);
  }
}

/**
 * Per-user generation cap — 10 jobs / minute. Protects Kling/Replicate
 * spend when the same signed-in account fans out from many IPs.
 */
export async function rateLimitGeneration(
  userId: string
): Promise<RateLimitResult> {
  const id = userId.trim() || "anon";
  try {
    const limiter = getUserGenLimiter();
    if (!limiter) {
      return isProductionRuntime()
        ? unavailableLimit()
        : memoryLimit(`gen-user:${id}`, 10, 60_000);
    }
    const res = await limiter.limit(id);
    return {
      success: res.success,
      limit: res.limit,
      remaining: res.remaining,
      reset: res.reset,
      source: "upstash",
    };
  } catch (error) {
    console.error("[Alnabiy] Upstash generation rate limit failed", error);
    return isProductionRuntime()
      ? unavailableLimit()
      : memoryLimit(`gen-user:${id}`, 10, 60_000);
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
