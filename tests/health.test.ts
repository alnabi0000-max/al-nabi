import { afterEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.hoisted(() => vi.fn());
const pingUpstash = vi.hoisted(() => vi.fn());
const isInngestConfigured = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: queryRaw },
}));

vi.mock("@/lib/security/upstash-config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/upstash-config")>(
    "@/lib/security/upstash-config"
  );
  return {
    ...actual,
    pingUpstash,
  };
});

vi.mock("@/lib/inngest/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/inngest/client")>(
    "@/lib/inngest/client"
  );
  return {
    ...actual,
    isInngestConfigured,
  };
});

import { getHealthReport } from "@/lib/health";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("getHealthReport", () => {
  it("stays healthy when the database is up even if Redis is unconfigured", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    pingUpstash.mockResolvedValue(null);
    isInngestConfigured.mockReturnValue(true);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_MODE", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.live"
    );
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://ready-hare.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const health = await getHealthReport();

    expect(health.ok).toBe(true);
    expect(health.database).toBe(true);
    expect(health.queue.inngest).toBe(true);
    expect(health.queue.mode).toBe("inngest");
    expect(health.rateLimit.upstash).toBe(false);
    expect(health.rateLimit.reachable).toBeNull();
  });

  it("fails closed when Prisma cannot query", async () => {
    queryRaw.mockRejectedValue(new Error("db down"));
    pingUpstash.mockResolvedValue(null);
    isInngestConfigured.mockReturnValue(false);

    const health = await getHealthReport();

    expect(health.ok).toBe(false);
    expect(health.database).toBe(false);
    expect(health.queue.mode).toBe("local");
  });
});
