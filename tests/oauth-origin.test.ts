import { describe, expect, it } from "vitest";
import {
  canonicalOAuthHref,
  canonicalOAuthOrigin,
  safeOAuthNextPath,
} from "@/lib/auth/oauth-origin";

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
