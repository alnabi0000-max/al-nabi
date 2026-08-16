/**
 * Native deep-link targets for the future iOS / Android builds.
 *
 * The mobile app runs the same PKCE flow as the web client, but the code
 * verifier lives on the device. The web `/auth/callback` route therefore never
 * exchanges a code destined for a native client — it forwards the code to the
 * registered custom scheme so the app can complete the exchange itself.
 */

const DEFAULT_SCHEME = "alnabi";

/** `alnabi` by default; override per-build with NEXT_PUBLIC_MOBILE_URL_SCHEME. */
export function mobileScheme(): string {
  const configured = process.env.NEXT_PUBLIC_MOBILE_URL_SCHEME?.trim();
  const scheme = (configured || DEFAULT_SCHEME).replace(/:.*$/, "");
  return /^[a-z][a-z0-9+.-]*$/i.test(scheme) ? scheme.toLowerCase() : DEFAULT_SCHEME;
}

/** Canonical native callback, e.g. `alnabi://auth/callback`. */
export function mobileCallbackUrl(): string {
  return `${mobileScheme()}://auth/callback`;
}

/**
 * Validate a caller-supplied redirect against the registered app scheme.
 * Returns the normalized URL, or `null` when it is not a trusted target.
 */
export function safeMobileRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${mobileScheme()}:`) return null;
  // Only the registered callback host/path is accepted — an arbitrary
  // `alnabi://…` target could exfiltrate the authorization code inside the app.
  const host = parsed.host || parsed.pathname.replace(/^\/+/, "").split("/")[0];
  if (host !== "auth") return null;
  return `${mobileScheme()}://auth/callback`;
}

/** True when the request asked for a native redirect target. */
export function isMobilePlatform(value: string | null | undefined): boolean {
  return value === "mobile" || value === "ios" || value === "android";
}

export function appendDeepLinkParams(
  base: string,
  params: Record<string, string | null | undefined>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}
