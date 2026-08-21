import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertProductionLaunchConfiguration,
  evaluateLaunchChecklist,
  isSupportedNodeRuntime,
  missingLaunchChecks,
  missingLaunchEnvNames,
} from "@/lib/launch/checklist";

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubLiveEnv() {
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@host:5432/db");
  vi.stubEnv("DIRECT_URL", "postgresql://u:p@db-host:5432/db");
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
  vi.stubEnv("ADMIN_API_SECRET", "admin-release-secret");
  vi.stubEnv("CRON_SECRET", "cron-release-secret");
  vi.stubEnv("ALNABIY_OBFUSCATE_SECRET", "obfuscate-release-secret");
  vi.stubEnv("SAFETY_FAIL_CLOSED", "1");
  vi.stubEnv("SAFETY_REFERENCE_MEDIA_MODE", "review");
  vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "");
  vi.stubEnv("R2_PUBLIC_URL", "");
  vi.stubEnv("AWS_S3_PUBLIC_URL", "");
  vi.stubEnv("S3_PUBLIC_URL", "");
  vi.stubEnv("ALNABIY_DEV_AUTH_BYPASS", "");
  vi.stubEnv("ALLOW_DEMO_CHECKOUT", "");
  vi.stubEnv("ALLOW_SOFT_CREDITS", "");
  vi.stubEnv("ALNABIY_FORCE_MOCK", "");
  vi.stubEnv("ALNABIY_ALLOW_AUDIO_MOCK", "");
  vi.stubEnv(
    "NEXT_PUBLIC_SENTRY_DSN",
    "https://public@example.ingest.sentry.io/123"
  );
  vi.stubEnv("RESEND_API_KEY", "re_live");
  vi.stubEnv("RESEND_FROM_EMAIL", "Al-Nabi <test@staging.example.test>");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://alnabiy.app");
}

describe("launch checklist", () => {
  it("reports missing keys on an empty env", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("DIRECT_URL", "");
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
    vi.stubEnv("ADMIN_API_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("ALNABIY_OBFUSCATE_SECRET", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const missing = missingLaunchChecks(evaluateLaunchChecklist());
    expect(missing.length).toBeGreaterThan(5);
    expect(missing.some((c) => c.id === "video")).toBe(true);
  });

  it("passes when required production keys are present", () => {
    stubLiveEnv();
    expect(missingLaunchChecks(evaluateLaunchChecklist("22.13.0"))).toEqual([]);
  });

  it("requires a direct Postgres URL for migration operations", () => {
    stubLiveEnv();
    vi.stubEnv("DIRECT_URL", "");

    expect(
      missingLaunchChecks(evaluateLaunchChecklist("22.13.0")).some(
        (check) => check.id === "database"
      )
    ).toBe(true);
  });

  it("requires the operational route secrets", () => {
    stubLiveEnv();
    vi.stubEnv("CRON_SECRET", "");

    expect(
      missingLaunchChecks(evaluateLaunchChecklist("22.13.0")).some(
        (check) => check.id === "operations"
      )
    ).toBe(true);
  });

  it("enforces the declared Node.js production runtime range", () => {
    expect(isSupportedNodeRuntime("22.13.0")).toBe(true);
    expect(isSupportedNodeRuntime("22.12.9")).toBe(false);
    expect(isSupportedNodeRuntime("23.0.0")).toBe(false);
    expect(isSupportedNodeRuntime("26.6.0")).toBe(false);
  });

  it("requires an explicit fail-closed safety configuration", () => {
    stubLiveEnv();
    vi.stubEnv("SAFETY_REFERENCE_MEDIA_MODE", "allow");

    expect(
      missingLaunchChecks(evaluateLaunchChecklist("22.13.0")).some(
        (check) => check.id === "safety"
      )
    ).toBe(true);
  });

  it("rejects public-media and development-bypass release configuration", () => {
    stubLiveEnv();
    vi.stubEnv("R2_PUBLIC_URL", "https://media.example.test");
    vi.stubEnv("ALNABIY_FORCE_MOCK", "1");

    expect(
      missingLaunchChecks(evaluateLaunchChecklist("22.13.0")).some(
        (check) => check.id === "release_guard"
      )
    ).toBe(true);
  });

  it("requires staging observability and transactional email settings", () => {
    stubLiveEnv();
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    vi.stubEnv("RESEND_API_KEY", "");

    const missing = missingLaunchChecks(evaluateLaunchChecklist("22.13.0"));
    expect(missing.some((check) => check.id === "observability")).toBe(true);
    expect(missing.some((check) => check.id === "email")).toBe(true);
  });

  it("names the env vars an operator must change without echoing values", () => {
    stubLiveEnv();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const names = missingLaunchEnvNames(evaluateLaunchChecklist("22.13.0"));
    expect(names).toEqual([
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ]);
    expect(JSON.stringify(names)).not.toMatch(/https?:\/\//);
  });

  it("names forbidden public-media variables that must be removed", () => {
    stubLiveEnv();
    vi.stubEnv("R2_PUBLIC_URL", "https://media.example.test");

    expect(
      missingLaunchEnvNames(evaluateLaunchChecklist("22.13.0"))
    ).toEqual(["R2_PUBLIC_URL"]);
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
