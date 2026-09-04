/**
 * Loopback hosts are not valid browser OAuth origins. PKCE cookies are
 * host-scoped, so starting Google on 127.0.0.1 and returning to localhost
 * (or the reverse) drops the verifier.
 */
const LOOPBACK_HOSTS = new Set([
  "0.0.0.0",
  "::",
  "127.0.0.1",
  "[::1]",
  "::1",
]);

export const GOOGLE_OAUTH_RESUME_KEY = "alnabiy.oauth.google.next";

export function isLoopbackOAuthHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
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
  return {
    origin: `${input.protocol}//${hostname}${port}`,
    rewritten,
  };
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
