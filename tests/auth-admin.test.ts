import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAdmin } from "@/lib/admin/auth";
import {
  getAuthSecret,
  getAuthMode,
  isSupabaseConfigured,
} from "@/lib/auth/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authentication configuration", () => {
  it("requires a production signing secret", () => {
    vi.stubEnv("NODE_ENV", "production");
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
