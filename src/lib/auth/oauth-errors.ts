/**
 * Safe, user-facing OAuth failure codes.
 *
 * Provider `error_description` strings are never forwarded in the URL — they
 * can contain tokens or PII. Only this allow-list is echoed back to the UI.
 */

export const OAUTH_ERROR_REASONS = [
  "denied",
  "not_enabled",
  "email_taken",
  "missing_code",
  "exchange_failed",
  "supabase_required",
  "identity_failed",
  "error",
] as const;

export type OAuthErrorReason = (typeof OAUTH_ERROR_REASONS)[number];

export function isOAuthErrorReason(
  value: string | null | undefined
): value is OAuthErrorReason {
  return Boolean(
    value && (OAUTH_ERROR_REASONS as readonly string[]).includes(value)
  );
}

export function oauthErrorMessageKey(reason: OAuthErrorReason): string {
  return `auth_oauth_${reason}`;
}

export function normalizeOAuthProviderError(
  error: string | null | undefined,
  description?: string | null
): OAuthErrorReason {
  const hay = `${error || ""} ${description || ""}`.toLowerCase();
  if (!hay.trim()) return "error";
  if (hay.includes("access_denied") || hay.includes("user denied")) {
    return "denied";
  }
  if (
    hay.includes("provider is not enabled") ||
    hay.includes("oauth_provider_not_supported") ||
    hay.includes("unsupported provider") ||
    hay.includes("validation failed") ||
    (hay.includes("google") && hay.includes("not enabled"))
  ) {
    return "not_enabled";
  }
  if (
    hay.includes("pkce") ||
    hay.includes("code verifier") ||
    hay.includes("bad_oauth_state") ||
    hay.includes("invalid flow state") ||
    hay.includes("unable to exchange")
  ) {
    return "exchange_failed";
  }
  return "error";
}
