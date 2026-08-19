export type AuthLikeError = {
  message?: string;
  code?: string;
} | null;

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
  if (isInvalidCredentials(error)) return "Invalid email or password";
  if (isAlreadyRegistered(error)) return "Email already registered";
  if (isEmailNotConfirmed(error)) {
    return "Email is not confirmed yet. Try again — the account will be activated.";
  }
  return error?.message || "Sign in failed";
}
