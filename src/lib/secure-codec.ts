/**
 * Lightweight payload obfuscation (AES-GCM when Web Crypto available).
 */

const FALLBACK_KEY = "Alnabiy-Enterprise-Shield-2026";

function toBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function fromBytes(b: ArrayBuffer): string {
  return new TextDecoder().decode(b);
}

function b64encode(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((c) => {
    s += String.fromCharCode(c);
  });
  if (typeof btoa !== "undefined") return btoa(s);
  return Buffer.from(bytes).toString("base64");
}

function b64decode(s: string): Uint8Array {
  const bin =
    typeof atob !== "undefined"
      ? atob(s)
      : Buffer.from(s, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(secret: string): Promise<CryptoKey | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const raw = toBytes(secret.padEnd(32, "0").slice(0, 32));
  return crypto.subtle.importKey(
    "raw",
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptLabel(
  plain: string,
  secret = process.env.ALNABIY_OBFUSCATE_SECRET || FALLBACK_KEY
): Promise<string> {
  const key = await deriveKey(secret);
  if (!key) {
    const k = toBytes(secret);
    const p = toBytes(plain);
    const out = new Uint8Array(p.length);
    for (let i = 0; i < p.length; i++) out[i] = p[i]! ^ k[i % k.length]!;
    return `x.${b64encode(out)}`;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = toBytes(plain);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plainBytes.buffer.slice(
      plainBytes.byteOffset,
      plainBytes.byteOffset + plainBytes.byteLength
    ) as ArrayBuffer
  );
  const packed = new Uint8Array(iv.length + cipher.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipher), iv.length);
  return `a.${b64encode(packed)}`;
}

export async function decryptLabel(
  token: string,
  secret = process.env.ALNABIY_OBFUSCATE_SECRET || FALLBACK_KEY
): Promise<string> {
  if (!token.includes(".")) return token;
  const [mode, payload] = token.split(".", 2);
  if (!payload) return token;
  const data = b64decode(payload);
  if (mode === "x") {
    const k = toBytes(secret);
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) out[i] = data[i]! ^ k[i % k.length]!;
    return fromBytes(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength));
  }
  const key = await deriveKey(secret);
  if (!key || data.length < 13) return "";
  const iv = data.slice(0, 12);
  const body = data.slice(12);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer
  );
  return fromBytes(plain);
}
