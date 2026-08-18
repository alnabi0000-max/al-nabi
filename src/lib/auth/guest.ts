/** Local/dev guest identity — never treat this as a signed-in studio user. */
export const DEV_GUEST_EMAIL = "dev@alnabiy.local";

export function isGuestEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return email.trim().toLowerCase() === DEV_GUEST_EMAIL;
}

/** True when the payload is a real (non-guest) signed-in user. */
export function isRealUserSession(data: {
  authenticated?: unknown;
  guest?: unknown;
  email?: unknown;
}): boolean {
  if (data.authenticated !== true) return false;
  if (data.guest === true) return false;
  const email = typeof data.email === "string" ? data.email : "";
  return !isGuestEmail(email);
}
