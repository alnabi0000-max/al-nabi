/**
 * API surface classification, shared by the Edge middleware and route guards.
 *
 * The policy is deny-by-default: every `/api/*` path requires a session token
 * unless it is listed below. A new endpoint is therefore protected the moment
 * it is added — a missing entry fails closed, never open.
 */

/** Endpoints reachable without a session, matched exactly. */
const PUBLIC_API_EXACT = new Set<string>([
  // The auth handshake itself — these establish or clear the session.
  "/api/auth/me",
  "/api/auth/ensure",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/magic-link",
  "/api/auth/session",
  "/api/auth/reset-password",
  "/api/auth/verify-key",
  // Anonymous browsing surfaces (static catalogs, no user data).
  "/api/credits",
  "/api/pricing",
  "/api/templates",
  "/api/music/tracks",
  "/api/health",
  "/api/inngest",
  "/api/checkout/webhook",
]);

/** Endpoints reachable without a session, matched by directory prefix. */
const PUBLIC_API_PREFIXES = [
  "/api/auth/otp/",
  "/api/webhooks/",
  "/api/inngest/",
] as const;

/**
 * Endpoints guarded by a shared secret (`ADMIN_API_SECRET`, `CRON_SECRET`,
 * Stripe/Inngest signatures) rather than by a user session. The session gate
 * must not reject them for lacking a user JWT.
 */
const SECRET_GUARDED_PREFIXES = ["/api/admin/", "/api/cron/"] as const;

/**
 * Admin financial analytics is gated by Prisma `User.role === ADMIN` on a
 * live session — not by `ADMIN_API_SECRET`. Middleware must require a JWT.
 */
const SESSION_ROLE_ADMIN_API = new Set(["/api/admin/analytics"]);

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/** Trailing slashes are normalized so `/api/pricing/` matches `/api/pricing`. */
function normalize(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isPublicApiPath(pathname: string): boolean {
  const path = normalize(pathname);
  if (PUBLIC_API_EXACT.has(path)) return true;
  return PUBLIC_API_PREFIXES.some((prefix) => `${path}/`.startsWith(prefix));
}

export function isSecretGuardedApiPath(pathname: string): boolean {
  const normalized = normalize(pathname);
  if (SESSION_ROLE_ADMIN_API.has(normalized)) return false;
  const path = `${normalized}/`;
  return SECRET_GUARDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** True when the path requires a verified user session token. */
export function requiresSessionToken(pathname: string): boolean {
  if (!isApiPath(pathname)) return false;
  if (isSecretGuardedApiPath(pathname)) return false;
  return !isPublicApiPath(pathname);
}
