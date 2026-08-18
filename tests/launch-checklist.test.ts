import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertProductionLaunchConfiguration,
  evaluateLaunchChecklist,
  missingLaunchChecks,
} from "@/lib/launch/checklist";

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubLiveEnv() {
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@host:5432/db");
  vi.stubEnv("AUTH_MODE", "supabase");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.live");
  vi.stubEnv("AUTH_SECRET", "abcdefghijklmnopqrstuvwxyz012345");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_abc");
  vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_live_abc");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_abc");
  vi.stubEnv("REPLICATE_API_KEY", "r8_livekey");
  vi.stubEnv("ELEVENLABS_API_KEY", "el_live");
  vi.stubEnv("OPENROUTER_API_KEY", "sk-or-v1-live");
  vi.stubEnv("INNGEST_EVENT_KEY", "evt_live");
  vi.stubEnv("INNGEST_SIGNING_KEY", "sign_live");
  vi.stubEnv("R2_ACCOUNT_ID", "acct");
  vi.stubEnv("R2_ACCESS_KEY_ID", "key");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
  vi.stubEnv("R2_BUCKET", "alnabi-media");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://alnabiy.app");
}

describe("launch checklist", () => {
  it("reports missing keys on an empty env", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("AUTH_MODE", "local");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_...");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.stubEnv("REPLICATE_API_KEY", "r8_...");
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-...");
    vi.stubEnv("INNGEST_EVENT_KEY", "");
    vi.stubEnv("INNGEST_SIGNING_KEY", "");
    vi.stubEnv("R2_ACCOUNT_ID", "");
    vi.stubEnv("R2_ACCESS_KEY_ID", "");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
    vi.stubEnv("R2_BUCKET", "");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "");
    vi.stubEnv("AWS_S3_BUCKET", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const missing = missingLaunchChecks(evaluateLaunchChecklist());
    expect(missing.length).toBeGreaterThan(5);
    expect(missing.some((c) => c.id === "video")).toBe(true);
  });

  it("passes when required production keys are present", () => {
    stubLiveEnv();
    expect(missingLaunchChecks()).toEqual([]);
  });

  it("refuses production boot when keys are missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("CI", "");
    vi.stubEnv("DATABASE_URL", "");
    expect(() => assertProductionLaunchConfiguration()).toThrow(/tayyor emas/i);
  });
});
