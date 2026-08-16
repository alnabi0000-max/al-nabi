import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAdmin } from "@/lib/admin/auth";
import {
  getAuthSecret,
  getAuthMode,
  isSupabaseConfigured,
  assertProductionAuthConfiguration,
} from "@/lib/auth/config";
import { shouldEnforceProductionSecrets } from "@/lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authentication configuration", () => {
  it("requires a production signing secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("CI", "");
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NEXTAUTH_SECRET", "");

    expect(getAuthSecret).toThrow(/must be set/i);
  });

  it("selects Supabase only when its public configuration is valid", () => {
    vi.stubEnv("AUTH_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    expect(isSupabaseConfigured()).toBe(true);
    expect(getAuthMode()).toBe("supabase");
  });

  it("treats placeholder Supabase keys as unconfigured in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://[PROJECT_REF].supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder-anon-key");

    expect(isSupabaseConfigured()).toBe(false);
    expect(getAuthMode()).toBe("local");
    expect(() => assertProductionAuthConfiguration()).not.toThrow();
  });

  it("fails closed on placeholder Supabase keys in production runtime", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("CI", "");
    vi.stubEnv("AUTH_MODE", "local");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://[PROJECT_REF].supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder-anon-key");

    expect(shouldEnforceProductionSecrets()).toBe(true);
    expect(() => assertProductionAuthConfiguration()).toThrow(
      /Invalid production authentication configuration/i
    );
  });

  it("does not fail-close a local next build against placeholder keys", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("CI", "");

    expect(shouldEnforceProductionSecrets()).toBe(false);
    expect(() => assertProductionAuthConfiguration()).not.toThrow();
  });
});

describe("admin authorization", () => {
  it("rejects missing, query-string, and incorrect secrets", () => {
    vi.stubEnv("ADMIN_API_SECRET", "release-secret");

    expect(
      assertAdmin(new NextRequest("https://example.test/api/admin/system"))
    ).toMatchObject({ ok: false });
    expect(
      assertAdmin(
        new NextRequest(
          "https://example.test/api/admin/system?secret=release-secret"
        )
      )
    ).toMatchObject({ ok: false });
    expect(
      assertAdmin(
        new NextRequest("https://example.test/api/admin/system", {
          headers: { authorization: "Bearer incorrect-secret" },
        })
      )
    ).toMatchObject({ ok: false });
  });

  it("accepts the configured bearer secret", () => {
    vi.stubEnv("ADMIN_API_SECRET", "release-secret");

    expect(
      assertAdmin(
        new NextRequest("https://example.test/api/admin/system", {
          headers: { authorization: "Bearer release-secret" },
        })
      )
    ).toEqual({ ok: true });
  });
});
