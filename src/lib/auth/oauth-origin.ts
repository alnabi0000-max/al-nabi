/**
 * Loopback / bind hosts are not valid browser OAuth origins.
 * Windows Chrome rejects http://0.0.0.0:3000 with ERR_ADDRESS_INVALID.
 * PKCE cookies are host-scoped, so 127.0.0.1 vs localhost also drops the verifier.
 */

const UNSAFE_BROWSER_HOSTS = new Set([
  "0.0.0.0",
  "::",
  "[::]",
  "[::0]",
]);

const LOOPBACK_HOSTS = new Set([
  ...UNSAFE_BROWSER_HOSTS,
  "127.0.0.1",
  "[::1]",
  "::1",
]);

export const GOOGLE_OAUTH_RESUME_KEY = "alnabiy.oauth.google.next";
const LOCAL_DEV_ORIGIN = "http://localhost:3000";

export function isUnsafeBrowserHost(hostname: string): boolean {
  return UNSAFE_BROWSER_HOSTS.has(hostname.trim().toLowerCase());
}

export function isLoopbackOAuthHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.trim().toLowerCase());
}

export function configuredPublicAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    ""
  );
}

function parseOriginParts(raw: string): {
  protocol: string;
  hostname: string;
  port: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withScheme = /:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
    const url = new URL(withScheme);
    return {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
    };
  } catch {
    return null;
  }
}

export function canonicalOAuthOrigin(input: {
  protocol: string;
  hostname: string;
  port?: string;
}): { origin: string; rewritten: boolean } {
  const hostname = isLoopbackOAuthHost(input.hostname)
    ? "localhost"
    : input.hostname;
  const rewritten = hostname !== input.hostname;
  const port = input.port ? `:${input.port}` : "";
  const protocol = input.protocol.endsWith(":")
    ? input.protocol
    : `${input.protocol}:`;
  return {
    origin: `${protocol}//${hostname}${port}`,
    rewritten,
  };
}

/**
 * Turn any host, Origin header, or absolute URL into a browser-safe origin.
 * `0.0.0.0` / `::` / `127.0.0.1` become `localhost`. Invalid input falls back
 * to NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL, then http://localhost:3000
 * outside production.
 */
export function normalizePublicOrigin(
  raw: string | null | undefined
): string {
  const parsed = raw ? parseOriginParts(raw) : null;
  if (parsed) {
    return canonicalOAuthOrigin(parsed).origin;
  }

  const configured = configuredPublicAppUrl();
  if (configured && configured !== raw) {
    const fromEnv = parseOriginParts(configured);
    if (fromEnv) return canonicalOAuthOrigin(fromEnv).origin;
  }

  return process.env.NODE_ENV === "production" ? "" : LOCAL_DEV_ORIGIN;
}

type HeaderSource = { get(name: string): string | null };

/**
 * Origin used for Supabase OAuth / magic-link / recovery redirects.
 * Production trusts only the configured public URL (never Host / Origin).
 * Development normalizes bind addresses so Windows never sees 0.0.0.0.
 */
export function publicAppOriginFromRequest(req: {
  url?: string;
  headers: HeaderSource;
  nextUrl?: { protocol: string; host: string };
}): string {
  const configured = configuredPublicAppUrl();

  if (process.env.NODE_ENV === "production") {
    return normalizePublicOrigin(configured || null);
  }

  if (configured) {
    return normalizePublicOrigin(configured);
  }

  const proto =
    req.headers.get("x-forwarded-proto") ||
    req.nextUrl?.protocol?.replace(/:$/, "") ||
    "http";
  const forwardedHost = req.headers.get("x-forwarded-host");
  const originHeader = req.headers.get("origin");
  const hostHeader = req.headers.get("host");
  const nextHost = req.nextUrl?.host;

  const candidates = [
    originHeader,
    forwardedHost ? `${proto}://${forwardedHost}` : null,
    hostHeader ? `${proto}://${hostHeader}` : null,
    req.url,
    nextHost ? `${proto}://${nextHost}` : null,
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    const origin = normalizePublicOrigin(candidate);
    if (origin) return origin;
  }

  return LOCAL_DEV_ORIGIN;
}

export function canonicalOAuthHref(locationLike: {
  protocol: string;
  hostname: string;
  port?: string;
  pathname?: string;
  search?: string;
  hash?: string;
}): string | null {
  const { origin, rewritten } = canonicalOAuthOrigin(locationLike);
  if (!rewritten) return null;
  return `${origin}${locationLike.pathname || ""}${locationLike.search || ""}${locationLike.hash || ""}`;
}

/** Only same-site relative paths — matches the auth callback allow-list. */
export function safeOAuthNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!/^\/(?!\/)[a-zA-Z0-9/_?&=%.-]*$/.test(raw)) return "/";
  if (raw.startsWith("/auth/callback")) return "/";
  return raw;
}
