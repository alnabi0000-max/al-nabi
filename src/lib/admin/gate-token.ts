/**
 * Encrypted admin-gate session token (AES-GCM).
 *
 * Edge-safe: WebCrypto only. Middleware verifies the cookie without Prisma.
 * Password changes bump `v` (tokenVersion); the Node layout rejects stale
 * versions. Expiry is enforced here so a stolen cookie dies with the TTL.
 */

export const ADMIN_GATE_COOKIE = "alnabiy_ag";
export const ADMIN_GATE_TTL_SEC = 8 * 60 * 60;

const TOKEN_PREFIX = "ag1.";
const CLOCK_SKEW_MS = 30_000;
const DEV_FALLBACK_SECRET = "alnabiy-local-dev-secret-change-me-32b";

export type AdminGatePayload = {
  v: number;
  iat: number;
  exp: number;
  n: string;
};

function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((c) => {
    binary += String.fromCharCode(c);
  });
  const b64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(token: string): Uint8Array | null {
  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/");
    const binary =
      typeof atob === "function"
        ? atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="))
        : Buffer.from(token, "base64url").toString("binary");
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function randomHex(bytes: number): string {
  const webCrypto = globalThis.crypto;
  const buf = new Uint8Array(bytes);
  webCrypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * AES-GCM key material. Production fails closed when no 32+ char secret is set.
 * Development may use the same local fallback as cookie HMAC signing.
 */
export function resolveAdminGateSecret(): string | null {
  const configured =
    process.env.ADMIN_GATE_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.ALNABIY_OBFUSCATE_SECRET?.trim() ||
    "";
  if (configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production") return null;
  return configured.length >= 32 ? configured : DEV_FALLBACK_SECRET;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const webCrypto = globalThis.crypto;
  const secretBytes = new TextEncoder().encode(`alnabiy-admin-gate-v1:${secret}`);
  const digest = await webCrypto.subtle.digest("SHA-256", toBuffer(secretBytes));
  return webCrypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function issueAdminGateToken(version: number): Promise<string> {
  const secret = resolveAdminGateSecret();
  if (!secret) {
    throw new Error("Admin gate secret is not configured");
  }
  const now = Date.now();
  const payload: AdminGatePayload = {
    v: version,
    iat: now,
    exp: now + ADMIN_GATE_TTL_SEC * 1000,
    n: randomHex(16),
  };
  const webCrypto = globalThis.crypto;
  const key = await deriveKey(secret);
  const iv = webCrypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await webCrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    toBuffer(plain)
  );
  const packed = new Uint8Array(iv.length + cipher.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipher), iv.length);
  return `${TOKEN_PREFIX}${bytesToB64url(packed)}`;
}

export async function readAdminGateToken(
  token: string | undefined | null
): Promise<AdminGatePayload | null> {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;
  const secret = resolveAdminGateSecret();
  if (!secret) return null;
  const packed = b64urlToBytes(token.slice(TOKEN_PREFIX.length));
  if (!packed || packed.length < 13) return null;

  try {
    const key = await deriveKey(secret);
    const iv = packed.slice(0, 12);
    const body = packed.slice(12);
    const plain = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      toBuffer(body)
    );
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<AdminGatePayload>;
    if (
      typeof candidate.v !== "number" ||
      typeof candidate.iat !== "number" ||
      typeof candidate.exp !== "number" ||
      typeof candidate.n !== "string"
    ) {
      return null;
    }
    if (candidate.exp + CLOCK_SKEW_MS < Date.now()) return null;
    return {
      v: candidate.v,
      iat: candidate.iat,
      exp: candidate.exp,
      n: candidate.n,
    };
  } catch {
    return null;
  }
}

export async function verifyAdminGateToken(
  token: string | undefined | null
): Promise<boolean> {
  return (await readAdminGateToken(token)) !== null;
}
