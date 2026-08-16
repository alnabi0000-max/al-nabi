/**
 * Edge-safe Supabase access-token inspection.
 *
 * Middleware runs on the Edge runtime and must stay dependency free, so this
 * module only uses WebCrypto. It is a *pre-filter*: it rejects tokens that are
 * structurally invalid, expired, or (when `SUPABASE_JWT_SECRET` is configured)
 * carry a bad HS256 signature. The authoritative check is always
 * `supabase.auth.getUser()` inside the route handler, which validates the token
 * against the Supabase Auth server.
 */

export type JwtClaims = {
  sub?: string;
  email?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string | string[];
  role?: string;
  session_id?: string;
  app_metadata?: { provider?: string; providers?: string[] };
  user_metadata?: Record<string, unknown>;
};

export type JwtInspection =
  | { valid: true; claims: JwtClaims; signatureChecked: boolean }
  | { valid: false; reason: JwtRejectReason };

export type JwtRejectReason =
  | "malformed"
  | "expired"
  | "missing_subject"
  | "bad_signature";

/** Clock skew tolerance between the Auth server and this runtime. */
const CLOCK_SKEW_SEC = 30;

function base64UrlDecode(segment: string): string | null {
  try {
    const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** WebCrypto wants a plain ArrayBuffer; typed-array views carry a wider type. */
function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function base64UrlToBytes(segment: string): Uint8Array | null {
  try {
    const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Decode without verifying. Never use the result for an authorization decision alone. */
export function decodeJwtClaims(token: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const json = base64UrlDecode(parts[1]);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as JwtClaims;
  } catch {
    return null;
  }
}

function jwtSecret(): string {
  return process.env.SUPABASE_JWT_SECRET?.trim() || "";
}

async function verifyHs256(token: string, secret: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const header = base64UrlDecode(parts[0]);
  if (!header) return false;
  try {
    const alg = (JSON.parse(header) as { alg?: string }).alg;
    // Asymmetric Supabase signing keys cannot be checked with the shared
    // secret. Defer those to the route-level getUser() call.
    if (alg !== "HS256") return true;
  } catch {
    return false;
  }

  const signature = base64UrlToBytes(parts[2]);
  if (!signature) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      toBuffer(encoder.encode(secret)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify(
      "HMAC",
      key,
      toBuffer(signature),
      toBuffer(encoder.encode(`${parts[0]}.${parts[1]}`))
    );
  } catch {
    return false;
  }
}

/**
 * Fail-closed inspection of an access token. Returns `valid: false` for
 * anything that cannot possibly represent a live session.
 */
export async function inspectAccessToken(
  token: string
): Promise<JwtInspection> {
  const claims = decodeJwtClaims(token);
  if (!claims) return { valid: false, reason: "malformed" };
  if (!claims.sub) return { valid: false, reason: "missing_subject" };

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === "number" && claims.exp + CLOCK_SKEW_SEC < now) {
    return { valid: false, reason: "expired" };
  }

  const secret = jwtSecret();
  if (!secret) return { valid: true, claims, signatureChecked: false };

  const ok = await verifyHs256(token, secret);
  if (!ok) return { valid: false, reason: "bad_signature" };
  return { valid: true, claims, signatureChecked: true };
}
