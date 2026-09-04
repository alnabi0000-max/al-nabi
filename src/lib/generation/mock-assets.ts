import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

/** 1×1 PNG — 68 bytes, no network. */
const MOCK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/**
 * Tiny ISO-BMFF MP4 (ftyp + free + mdat + moov). Written locally so mock
 * persist never fetches GCS/placehold. Players that need a full AVC sample
 * still get a completed local object; Studio no longer waits on a remote clip.
 */
const MOCK_MP4_HEX =
  "000000186674797069736f6d0000020069736f6d69736f326d703431" +
  "0000000866726565" +
  "000000086d646174" +
  "0000006d6d6f6f76" +
  "0000006d6d76686400000000" +
  "0000000000000000000000000000000100000000000000000000000000000000" +
  "0001000000000000000000000000000000010000000000000000000000000000" +
  "4000000000000000000000000000000000000000000000000000000000000002";

export type MockAssetKind = "image" | "video";

export function mockPublicPath(kind: MockAssetKind): string {
  return kind === "image" ? "/dev-mock/preview.png" : "/dev-mock/preview.mp4";
}

export function mockContentType(kind: MockAssetKind): string {
  return kind === "image" ? "image/png" : "video/mp4";
}

export function mockAssetBytes(kind: MockAssetKind): Buffer {
  if (kind === "image") {
    return Buffer.from(MOCK_PNG_BASE64, "base64");
  }
  return Buffer.from(MOCK_MP4_HEX, "hex");
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/** PNG signature or ISO-BMFF `ftyp` — enough to serve without crashing. */
export function isValidMockAssetBytes(
  kind: MockAssetKind,
  bytes: Buffer
): boolean {
  if (!bytes || bytes.length < 8) return false;
  if (kind === "image") {
    return bytes.subarray(0, 8).equals(PNG_SIGNATURE);
  }
  return bytes.subarray(4, 8).toString("ascii") === "ftyp";
}

export function mockAssetsDir(): string {
  return path.join(process.cwd(), "public", "dev-mock");
}

/**
 * Ensure a local fixture file exists and return its filesystem path.
 * Never returns an http(s) URL. Valid files already on disk are kept so a
 * richer preview is not replaced by the tiny embedded fallback.
 */
export function ensureMockAssetPath(kind: MockAssetKind): string {
  const file = kind === "image" ? "preview.png" : "preview.mp4";
  const dir = mockAssetsDir();
  const full = path.join(dir, file);
  if (existsSync(full)) {
    try {
      const existing = readFileSync(full);
      if (isValidMockAssetBytes(kind, existing)) {
        return full;
      }
    } catch {
      /* rewrite below */
    }
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(full, mockAssetBytes(kind));
  return full;
}
