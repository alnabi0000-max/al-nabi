/**
 * Authenticated label encryption using AES-GCM.
 */

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

function requireObfuscationSecret(secret?: string): string {
  const value = secret?.trim() || process.env.ALNABIY_OBFUSCATE_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error(
      "ALNABIY_OBFUSCATE_SECRET must be set to a random value of at least 32 characters."
    );
  }
  return value;
}

function requireWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is required for secure label encryption.");
  }
  return globalThis.crypto;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const webCrypto = requireWebCrypto();
  const secretBytes = toBytes(secret);
  const digest = await webCrypto.subtle.digest(
    "SHA-256",
    secretBytes.buffer.slice(
      secretBytes.byteOffset,
      secretBytes.byteOffset + secretBytes.byteLength
    ) as ArrayBuffer
  );
  return webCrypto.subtle.importKey(
    "raw",
    digest,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptLabel(
  plain: string,
  secret?: string
): Promise<string> {
  const webCrypto = requireWebCrypto();
  const key = await deriveKey(requireObfuscationSecret(secret));
  const iv = webCrypto.getRandomValues(new Uint8Array(12));
  const plainBytes = toBytes(plain);
  const cipher = await webCrypto.subtle.encrypt(
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
  secret?: string
): Promise<string> {
  const webCrypto = requireWebCrypto();
  const key = await deriveKey(requireObfuscationSecret(secret));
  if (!token.includes(".")) return token;
  const [mode, payload] = token.split(".", 2);
  if (mode !== "a" || !payload) return "";

  try {
    const data = b64decode(payload);
    if (data.length < 13) return "";
    const iv = data.slice(0, 12);
    const body = data.slice(12);
    const plain = await webCrypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      body.buffer.slice(
        body.byteOffset,
        body.byteOffset + body.byteLength
      ) as ArrayBuffer
    );
    return fromBytes(plain);
  } catch {
    return "";
  }
}
