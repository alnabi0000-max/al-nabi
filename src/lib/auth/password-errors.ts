export type AuthLikeError = {
  message?: string;
  code?: string;
} | null;

export const PUBLIC_AUTH_ERRORS = {
  invalid: "Invalid email or password",
  taken: "Email already registered",
  unconfirmed:
    "Email is not confirmed yet. Try again — the account will be activated.",
  failed: "Sign in failed",
  banned: "ACCOUNT PERMANENTLY BANNED",
  rateLimited: "Too many requests",
  unavailable: "Auth unavailable",
} as const;

function haystack(error: AuthLikeError): string {
  return `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
}

export function isEmailNotConfirmed(error: AuthLikeError): boolean {
  const msg = haystack(error);
  return msg.includes("email_not_confirmed") || msg.includes("email not confirmed");
}

export function isAlreadyRegistered(error: AuthLikeError): boolean {
  const msg = haystack(error);
  return (
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    msg.includes("user_already_exists") ||
    msg.includes("email_exists")
  );
}

export function isInvalidCredentials(error: AuthLikeError): boolean {
  const msg = haystack(error);
  return (
    msg.includes("invalid login") ||
    msg.includes("invalid_credentials") ||
    msg.includes("invalid email or password")
  );
}

/** Safe public copy — never leak GoTrue internals to the login form. */
export function publicPasswordAuthError(error: AuthLikeError): string {
  if (isInvalidCredentials(error)) return PUBLIC_AUTH_ERRORS.invalid;
  if (isAlreadyRegistered(error)) return PUBLIC_AUTH_ERRORS.taken;
  if (isEmailNotConfirmed(error)) return PUBLIC_AUTH_ERRORS.unconfirmed;
  return PUBLIC_AUTH_ERRORS.failed;
}

/** Map a public API error string onto a locale key. Unknown text stays raw. */
export function publicAuthMessageKey(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("already registered")) return "auth_email_taken";
  if (m.includes("invalid email or password")) return "auth_invalid_credentials";
  if (m.includes("not confirmed")) return "auth_confirm_email";
  if (m.includes("too many")) return "auth_rate_limited";
  if (
    m.includes("auth unavailable") ||
    m.includes("supabase required") ||
    m.includes("supabase sozlang")
  ) {
    return "auth_supabase_required";
  }
  if (m.includes("banned")) return "bannedTitle";
  if (m.includes("network")) return "network_error";
  return null;
}

export function localizeAuthError(
  message: string,
  translate: (key: string) => string
): string {
  const key = publicAuthMessageKey(message);
  if (key) return translate(key);
  const trimmed = message.trim();
  return trimmed || translate("auth_error");
}
