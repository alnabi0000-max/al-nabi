import { describe, expect, it } from "vitest";
import {
  extractSupabaseIdentity,
  fallbackAuthEmail,
  resolveAuthAvatar,
  resolveAuthEmail,
  resolveAuthName,
} from "@/lib/auth/identity";
import {
  isOAuthErrorReason,
  normalizeOAuthProviderError,
  oauthErrorMessageKey,
} from "@/lib/auth/oauth-errors";
import {
  appendAuthQuery,
  googleOAuthQueryParams,
  oauthBrowserCallbackUrl,
  readOAuthNextFromCookieHeader,
  safeNextPath,
} from "@/lib/auth/oauth-redirect";

function googleUser(overrides?: {
  email?: string | null;
  metadata?: Record<string, unknown>;
  identities?: Array<{
    provider?: string;
    identity_data?: Record<string, unknown>;
  }>;
}) {
  return {
    id: "6b1f2c3d-0000-4000-a000-0123456789ab",
    email: overrides?.email ?? null,
    app_metadata: { provider: "google" },
    user_metadata: overrides?.metadata ?? {},
    identities: overrides?.identities ?? [],
  };
}

describe("Google identity extraction", () => {
  it("reads email from user.email", () => {
    expect(
      resolveAuthEmail(googleUser({ email: "Creator@Gmail.com" }))
    ).toBe("creator@gmail.com");
  });

  it("falls back to user_metadata and identity_data when email is empty", () => {
    expect(
      resolveAuthEmail(
        googleUser({
          email: null,
          metadata: { email: "meta@gmail.com" },
        })
      )
    ).toBe("meta@gmail.com");
    expect(
      resolveAuthEmail(
        googleUser({
          email: "",
          identities: [
            {
              provider: "google",
              identity_data: { email: "id@gmail.com" },
            },
          ],
        })
      )
    ).toBe("id@gmail.com");
  });

  it("synthesizes an email when Google omits the address", () => {
    const user = googleUser({ email: null });
    expect(resolveAuthEmail(user)).toBe(fallbackAuthEmail(user.id));
  });

  it("reads name and avatar from Google metadata", () => {
    const user = googleUser({
      email: "a@b.com",
      metadata: {
        full_name: "Al Nabi",
        picture: "https://lh3.googleusercontent.com/photo.jpg",
      },
    });
    expect(resolveAuthName(user)).toBe("Al Nabi");
    expect(resolveAuthAvatar(user)).toBe(
      "https://lh3.googleusercontent.com/photo.jpg"
    );
  });

  it("maps a Google user to a GOOGLE identity", () => {
    const identity = extractSupabaseIdentity(
      googleUser({
        email: "creator@gmail.com",
        metadata: { name: "Creator", avatar_url: "https://img/a.png" },
      })
    );
    expect(identity).toMatchObject({
      id: "6b1f2c3d-0000-4000-a000-0123456789ab",
      email: "creator@gmail.com",
      name: "Creator",
      avatarUrl: "https://img/a.png",
      authProvider: "GOOGLE",
    });
  });

  it("returns null without a user id", () => {
    expect(extractSupabaseIdentity(null)).toBeNull();
  });
});

describe("OAuth redirect helpers", () => {
  it("keeps the callback URL query-free so the Supabase allow-list matches", () => {
    expect(oauthBrowserCallbackUrl("https://alnabiy.app/")).toBe(
      "https://alnabiy.app/auth/callback"
    );
    expect(oauthBrowserCallbackUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/auth/callback"
    );
  });

  it("accepts only same-site relative next paths", () => {
    expect(safeNextPath("/profile?tab=kabinet")).toBe("/profile?tab=kabinet");
    expect(safeNextPath("https://evil.example/phish")).toBe(
      "/profile?tab=kabinet"
    );
    expect(safeNextPath("//evil.com")).toBe("/profile?tab=kabinet");
    expect(safeNextPath(null)).toBe("/profile?tab=kabinet");
  });

  it("appends a safe auth flag without losing the tab", () => {
    expect(appendAuthQuery("/profile?tab=kabinet", "ok")).toBe(
      "/profile?tab=kabinet&auth=ok"
    );
    expect(appendAuthQuery("/profile?tab=umumiy", "error", "denied")).toBe(
      "/profile?tab=umumiy&auth=error&reason=denied"
    );
  });

  it("reads the short-lived next cookie", () => {
    expect(
      readOAuthNextFromCookieHeader(
        "other=1; alnabiy_oauth_next=%2Fprofile%3Ftab%3Dkabinet; sb-x=1"
      )
    ).toBe("/profile?tab=kabinet");
    expect(readOAuthNextFromCookieHeader("")).toBeNull();
  });

  it("asks Google for account picker and locale", () => {
    expect(googleOAuthQueryParams("uz")).toEqual({
      access_type: "offline",
      prompt: "select_account",
      hl: "uz",
    });
    expect(googleOAuthQueryParams("")).toEqual({
      access_type: "offline",
      prompt: "select_account",
    });
  });
});

describe("OAuth error mapping", () => {
  it("maps provider errors to a closed allow-list", () => {
    expect(normalizeOAuthProviderError("access_denied")).toBe("denied");
    expect(
      normalizeOAuthProviderError("oauth_provider_not_supported")
    ).toBe("not_enabled");
    expect(normalizeOAuthProviderError("bad_oauth_state")).toBe(
      "exchange_failed"
    );
    expect(normalizeOAuthProviderError("server_error")).toBe("error");
    expect(isOAuthErrorReason("email_taken")).toBe(true);
    expect(isOAuthErrorReason("drop_table")).toBe(false);
    expect(oauthErrorMessageKey("not_enabled")).toBe("auth_oauth_not_enabled");
  });
});
