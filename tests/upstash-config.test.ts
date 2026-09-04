import { afterEach, describe, expect, it, vi } from "vitest";
import { isUpstashConfigured } from "@/lib/security/upstash-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isUpstashConfigured", () => {
  it("requires a live HTTPS URL and a real token", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://ready-hare-12345.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "AXxxxxxxxxxxxxxxxx");
    expect(isUpstashConfigured()).toBe(true);
  });

  it("rejects a URL without a token", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://ready-hare-12345.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(isUpstashConfigured()).toBe(false);
  });

  it("rejects placeholders", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://your-project.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "changeme");
    expect(isUpstashConfigured()).toBe(false);
  });
});
