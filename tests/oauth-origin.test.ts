import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canonicalOAuthHref,
  canonicalOAuthOrigin,
  normalizePublicOrigin,
  publicAppOriginFromRequest,
  safeOAuthNextPath,
} from "@/lib/auth/oauth-origin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("canonicalOAuthOrigin", () => {
  it("rewrites loopback hosts to localhost so PKCE cookies survive", () => {
    expect(
      canonicalOAuthOrigin({
        protocol: "http:",
        hostname: "127.0.0.1",
        port: "3000",
      })
    ).toEqual({ origin: "http://localhost:3000", rewritten: true });
    expect(
      canonicalOAuthOrigin({
        protocol: "http:",
        hostname: "0.0.0.0",
        port: "3000",
      })
    ).toEqual({ origin: "http://localhost:3000", rewritten: true });
  });

  it("leaves localhost and production hosts unchanged", () => {
    expect(
      canonicalOAuthOrigin({
        protocol: "http:",
        hostname: "localhost",
        port: "3000",
      })
    ).toEqual({ origin: "http://localhost:3000", rewritten: false });
    expect(
      canonicalOAuthOrigin({
        protocol: "https:",
        hostname: "alnabiy.app",
      })
    ).toEqual({ origin: "https://alnabiy.app", rewritten: false });
  });
});

describe("normalizePublicOrigin", () => {
  it("rewrites bind and loopback URLs to localhost", () => {
    expect(normalizePublicOrigin("http://0.0.0.0:3000")).toBe(
      "http://localhost:3000"
    );
    expect(normalizePublicOrigin("0.0.0.0:3000")).toBe("http://localhost:3000");
    expect(normalizePublicOrigin("http://127.0.0.1:3000/auth/callback")).toBe(
      "http://localhost:3000"
    );
  });

  it("falls back to localhost in development when the value is empty", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(normalizePublicOrigin("")).toBe("http://localhost:3000");
  });

  it("accepts NEXT_PUBLIC_SITE_URL as an alias", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://0.0.0.0:3000");
    expect(normalizePublicOrigin(null)).toBe("http://localhost:3000");
  });
});

describe("publicAppOriginFromRequest", () => {
  it("normalizes a 0.0.0.0 Host header in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const origin = publicAppOriginFromRequest({
      url: "http://0.0.0.0:3000/auth/callback",
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "host" ? "0.0.0.0:3000" : null,
      },
      nextUrl: { protocol: "http:", host: "0.0.0.0:3000" },
    });
    expect(origin).toBe("http://localhost:3000");
  });

  it("prefers configured APP_URL over the request host", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    const origin = publicAppOriginFromRequest({
      url: "http://0.0.0.0:3000/auth/callback",
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "host" ? "0.0.0.0:3000" : null,
      },
      nextUrl: { protocol: "http:", host: "0.0.0.0:3000" },
    });
    expect(origin).toBe("http://localhost:3000");
  });

  it("does not trust Host in production when APP_URL is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://alnabiy.app");
    const origin = publicAppOriginFromRequest({
      url: "http://0.0.0.0:3000/auth/callback",
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "host" ? "evil.example" : null,
      },
      nextUrl: { protocol: "http:", host: "evil.example" },
    });
    expect(origin).toBe("https://alnabiy.app");
  });
});

describe("canonicalOAuthHref", () => {
  it("returns a localhost href for 127.0.0.1", () => {
    expect(
      canonicalOAuthHref({
        protocol: "http:",
        hostname: "127.0.0.1",
        port: "3000",
        pathname: "/generate",
        search: "",
        hash: "",
      })
    ).toBe("http://localhost:3000/generate");
  });

  it("returns a localhost href for 0.0.0.0", () => {
    expect(
      canonicalOAuthHref({
        protocol: "http:",
        hostname: "0.0.0.0",
        port: "3000",
        pathname: "/",
      })
    ).toBe("http://localhost:3000/");
  });

  it("returns null when already on the canonical host", () => {
    expect(
      canonicalOAuthHref({
        protocol: "http:",
        hostname: "localhost",
        port: "3000",
        pathname: "/",
      })
    ).toBeNull();
  });
});

describe("safeOAuthNextPath", () => {
  it("rejects off-site and callback loops", () => {
    expect(safeOAuthNextPath("//evil.com")).toBe("/");
    expect(safeOAuthNextPath("/auth/callback?code=x")).toBe("/");
    expect(safeOAuthNextPath("/generate")).toBe("/generate");
  });
});
