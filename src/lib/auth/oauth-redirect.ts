/**
 * OAuth return-path helpers.
 *
 * Supabase's redirect allow-list is an exact (or wildcard) match. Putting
 * `?next=` on `/auth/callback` is the most common reason Google sign-in
 * fails after a correctly configured Client ID. The browser therefore
 * redirects to the clean callback URL and stores the intended path in a
 * short-lived first-party cookie.
 */

export const OAUTH_NEXT_COOKIE = "alnabiy_oauth_next";
export const OAUTH_NEXT_MAX_AGE_SEC = 10 * 60;
export const DEFAULT_AFTER_AUTH = "/profile?tab=kabinet";
export const OAUTH_ERROR_PATH = "/profile?tab=umumiy";
export const OAUTH_CALLBACK_PATH = "/auth/callback";

/** Only allow same-site relative paths — blocks `//evil.com`, `https://…`. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_AFTER_AUTH;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep the raw value */
  }
  if (!/^\/(?!\/)[a-zA-Z0-9/_?&=%.+-]*$/.test(value)) return DEFAULT_AFTER_AUTH;
  return value;
}

/** Site-origin + `/auth/callback` with no query string (allow-list safe). */
export function oauthBrowserCallbackUrl(origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${OAUTH_CALLBACK_PATH}`;
}

export function appendAuthQuery(
  path: string,
  auth: "ok" | "error" | "local",
  reason?: string | null
): string {
  const url = new URL(safeNextPath(path), "https://alnabiy.invalid");
  url.searchParams.set("auth", auth);
  if (reason) url.searchParams.set("reason", reason);
  else url.searchParams.delete("reason");
  return `${url.pathname}${url.search}`;
}

export function oauthNextCookieWriteOptions(secure: boolean): {
  path: string;
  maxAge: number;
  sameSite: "lax";
  secure: boolean;
} {
  return {
    path: "/",
    maxAge: OAUTH_NEXT_MAX_AGE_SEC,
    sameSite: "lax",
    secure,
  };
}

/** Browser helper — the path is re-validated on the server. */
export function setOAuthNextCookie(next: string): void {
  if (typeof document === "undefined") return;
  const safe = safeNextPath(next);
  const secure = window.location.protocol === "https:";
  document.cookie = [
    `${OAUTH_NEXT_COOKIE}=${encodeURIComponent(safe)}`,
    "Path=/",
    `Max-Age=${OAUTH_NEXT_MAX_AGE_SEC}`,
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function readOAuthNextFromCookieHeader(
  cookieHeader: string | null | undefined
): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name !== OAUTH_NEXT_COOKIE) continue;
    const raw = trimmed.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

export function googleOAuthQueryParams(locale?: string | null): {
  access_type: string;
  prompt: string;
  hl?: string;
} {
  const hl = (locale || "").trim().toLowerCase().split("-")[0];
  return {
    access_type: "offline",
    prompt: "select_account",
    ...(hl && /^[a-z]{2}$/.test(hl) ? { hl } : {}),
  };
}
