import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readBearerToken } from "@/lib/auth/bearer";
import { decodeJwtClaims, inspectAccessToken } from "@/lib/auth/jwt";
import {
  isPublicApiPath,
  isSecretGuardedApiPath,
  requiresSessionToken,
} from "@/lib/auth/protected-routes";
import {
  mobileCallbackUrl,
  safeMobileRedirect,
  appendDeepLinkParams,
} from "@/lib/auth/deep-link";
import { resolveAuthProvider } from "@/lib/auth/providers";

const SECRET = "test-jwt-secret";

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeToken(
  claims: Record<string, unknown>,
  opts?: { secret?: string; alg?: string }
): string {
  const header = base64Url(JSON.stringify({ alg: opts?.alg ?? "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify(claims));
  const signature = createHmac("sha256", opts?.secret ?? SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function liveClaims(extra?: Record<string, unknown>) {
  return {
    sub: "6b1f2c3d-0000-4000-a000-0123456789ab",
    email: "creator@alnabiy.app",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...extra,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("bearer token extraction", () => {
  it("reads the token from an Authorization header", () => {
    const headers = new Headers({ authorization: "Bearer abc.def.ghi" });
    expect(readBearerToken(headers)).toBe("abc.def.ghi");
  });

  it("ignores non-bearer and empty authorization schemes", () => {
    expect(readBearerToken(new Headers({ authorization: "Basic abc" }))).toBeNull();
    expect(readBearerToken(new Headers({ authorization: "Bearer " }))).toBeNull();
    expect(readBearerToken(new Headers())).toBeNull();
  });
});

describe("access token inspection", () => {
  it("decodes claims without a secret configured", async () => {
    vi.stubEnv("SUPABASE_JWT_SECRET", "");
    const token = makeToken(liveClaims());

    expect(decodeJwtClaims(token)?.email).toBe("creator@alnabiy.app");

    const result = await inspectAccessToken(token);
    expect(result).toMatchObject({ valid: true, signatureChecked: false });
  });

  it("rejects malformed tokens", async () => {
    expect(await inspectAccessToken("not-a-jwt")).toMatchObject({
      valid: false,
      reason: "malformed",
    });
  });

  it("rejects tokens without a subject", async () => {
    const token = makeToken({ email: "x@y.z", exp: Math.floor(Date.now() / 1000) + 60 });
    expect(await inspectAccessToken(token)).toMatchObject({
      valid: false,
      reason: "missing_subject",
    });
  });

  it("rejects expired tokens", async () => {
    const token = makeToken(
      liveClaims({ exp: Math.floor(Date.now() / 1000) - 120 })
    );
    expect(await inspectAccessToken(token)).toMatchObject({
      valid: false,
      reason: "expired",
    });
  });

  it("verifies the HS256 signature when the secret is configured", async () => {
    vi.stubEnv("SUPABASE_JWT_SECRET", SECRET);

    expect(await inspectAccessToken(makeToken(liveClaims()))).toMatchObject({
      valid: true,
      signatureChecked: true,
    });
    expect(
      await inspectAccessToken(makeToken(liveClaims(), { secret: "wrong-secret" }))
    ).toMatchObject({ valid: false, reason: "bad_signature" });
  });

  it("defers asymmetric signing keys to the Auth server", async () => {
    vi.stubEnv("SUPABASE_JWT_SECRET", SECRET);
    const token = makeToken(liveClaims(), { alg: "RS256" });
    expect(await inspectAccessToken(token)).toMatchObject({ valid: true });
  });
});

describe("API route protection policy", () => {
  it("protects unlisted endpoints by default", () => {
    expect(requiresSessionToken("/api/generate")).toBe(true);
    expect(requiresSessionToken("/api/producer/chat")).toBe(true);
    expect(requiresSessionToken("/api/assets")).toBe(true);
    expect(requiresSessionToken("/api/some/brand/new/endpoint")).toBe(true);
  });

  it("keeps the auth handshake and public catalogs reachable", () => {
    for (const path of [
      "/api/auth/me",
      "/api/auth/ensure",
      "/api/auth/magic-link",
      "/api/auth/otp/send",
      "/api/auth/otp/verify",
      "/api/auth/session",
      "/api/pricing",
      "/api/templates",
      "/api/credits",
      "/api/webhooks/stripe",
      "/api/checkout/webhook",
    ]) {
      expect(isPublicApiPath(path), path).toBe(true);
      expect(requiresSessionToken(path), path).toBe(false);
    }
  });

  it("does not let a public prefix leak into a sibling endpoint", () => {
    expect(requiresSessionToken("/api/credits/charge")).toBe(true);
    expect(requiresSessionToken("/api/checkout/create-session")).toBe(true);
    expect(requiresSessionToken("/api/auth/otpx")).toBe(true);
  });

  it("exempts secret-guarded surfaces from the user-session gate", () => {
    expect(isSecretGuardedApiPath("/api/cron/model-watch")).toBe(true);
    expect(requiresSessionToken("/api/cron/model-watch")).toBe(false);
  });

  it("requires a live admin session for role-gated admin surfaces", () => {
    expect(isSecretGuardedApiPath("/api/admin/system")).toBe(false);
    expect(requiresSessionToken("/api/admin/system")).toBe(true);
  });

  it("ignores non-API paths", () => {
    expect(requiresSessionToken("/profile")).toBe(false);
    expect(requiresSessionToken("/auth/callback")).toBe(false);
  });
});

describe("native deep links", () => {
  it("accepts only the registered scheme and callback host", () => {
    expect(safeMobileRedirect("alnabi://auth/callback")).toBe(
      "alnabi://auth/callback"
    );
    expect(safeMobileRedirect("https://evil.example/auth/callback")).toBeNull();
    expect(safeMobileRedirect("alnabi://evil/callback")).toBeNull();
    expect(safeMobileRedirect("javascript:alert(1)")).toBeNull();
    expect(safeMobileRedirect(null)).toBeNull();
  });

  it("honours a configured custom scheme", () => {
    vi.stubEnv("NEXT_PUBLIC_MOBILE_URL_SCHEME", "alnabistudio");
    expect(mobileCallbackUrl()).toBe("alnabistudio://auth/callback");
    expect(safeMobileRedirect("alnabi://auth/callback")).toBeNull();
  });

  it("appends only the parameters that have values", () => {
    expect(
      appendDeepLinkParams("alnabi://auth/callback", {
        code: "abc123",
        error: null,
        next: undefined,
      })
    ).toBe("alnabi://auth/callback?code=abc123");
  });
});

describe("auth provider mapping", () => {
  it("maps social identities regardless of the requesting flow", () => {
    expect(
      resolveAuthProvider({ app_metadata: { provider: "google" }, identities: [] })
    ).toBe("GOOGLE");
    expect(
      resolveAuthProvider(
        { app_metadata: { provider: "apple" }, identities: [] },
        "EMAIL_OTP"
      )
    ).toBe("APPLE");
  });

  it("keeps the caller's passwordless flow for email identities", () => {
    expect(
      resolveAuthProvider(
        { app_metadata: { provider: "email" }, identities: [] },
        "EMAIL_OTP"
      )
    ).toBe("EMAIL_OTP");
    expect(
      resolveAuthProvider({ app_metadata: { provider: "email" }, identities: [] })
    ).toBe("MAGIC_LINK");
  });

  it("falls back to magic link for unknown identities", () => {
    expect(resolveAuthProvider(null)).toBe("MAGIC_LINK");
  });
});
