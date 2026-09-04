import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isOAuthProviderEnabled,
  oauthProbePayload,
  shouldOfferGoogleOAuth,
} from "@/lib/auth/oauth-providers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubSupabase() {
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "https://abcdefghijklmnop.supabase.co"
  );
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"
  );
}

describe("shouldOfferGoogleOAuth", () => {
  it("hides Google only when the probe says the provider is off", () => {
    expect(shouldOfferGoogleOAuth({ google: false })).toBe(false);
  });

  it("starts Google when the probe confirms the provider", () => {
    expect(shouldOfferGoogleOAuth({ google: true })).toBe(true);
  });

  it("starts Google when the probe is down or rate-limited", () => {
    expect(shouldOfferGoogleOAuth(null)).toBe(true);
    expect(shouldOfferGoogleOAuth({})).toBe(true);
  });
});

describe("oauthProbePayload", () => {
  it("omits the flag when GoTrue is unreachable so the button still starts", () => {
    expect(oauthProbePayload("google", null)).toEqual({});
  });

  it("sets google true/false only from a definite probe", () => {
    expect(oauthProbePayload("google", true)).toEqual({ google: true });
    expect(oauthProbePayload("google", false)).toEqual({ google: false });
  });
});

describe("isOAuthProviderEnabled", () => {
  it("returns false when GoTrue says the provider is not enabled", async () => {
    stubSupabase();
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: 400,
          error_code: "validation_failed",
          msg: "Unsupported provider: provider is not enabled",
        }),
        { status: 400 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await isOAuthProviderEnabled("google")).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns true when GoTrue redirects to the identity provider", async () => {
    stubSupabase();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://accounts.google.com/o/oauth2/v2/auth" },
          })
      )
    );

    expect(await isOAuthProviderEnabled("google")).toBe(true);
  });

  it("returns null instead of hanging when the probe is aborted", async () => {
    stubSupabase();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: unknown, init?: { signal?: AbortSignal }) =>
          new Promise((_, reject) => {
            const fail = () => {
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
            };
            if (init?.signal?.aborted) {
              fail();
              return;
            }
            init?.signal?.addEventListener("abort", fail, { once: true });
          })
      )
    );

    expect(await isOAuthProviderEnabled("google", 20)).toBe(null);
  });
});
