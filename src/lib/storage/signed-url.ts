import path from "path";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getObjectStorageClient } from "@/lib/storage/object-storage";

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function normalizeObjectKey(key: string): string {
  return key.replace(/\\/g, "/").replace(/^\/+/, "");
}

/** Authenticated local-disk path used when R2/S3 is not configured. */
export function localObjectMediaPath(key: string): string {
  return `/api/media/objects/${normalizeObjectKey(key)}`;
}

/** Absolute filesystem path for a locally persisted object. */
export function localStoredObjectPath(key: string): string {
  const root = process.env.STORAGE_DIR || "./storage";
  return path.join(process.cwd(), root, "objects", ...normalizeObjectKey(key).split("/"));
}

/**
 * R2/S3 object uchun vaqtinchalik signed GET URL (default 1 soat).
 * Storage sozlanmagan bo‘lsa null.
 */
export async function createSignedGetUrl(
  key: string,
  expiresInSec = 3600
): Promise<string | null> {
  const s3 = getObjectStorageClient();
  if (!s3 || !key) return null;

  const command = new GetObjectCommand({
    Bucket: s3.bucket,
    Key: key.replace(/^\/+/, ""),
  });
  return getSignedUrl(s3.client, command, { expiresIn: expiresInSec });
}

/**
 * Owner-facing delivery URL. Production only returns a signed object URL.
 * Local development may fall back to the authenticated `/api/media` route
 * (or a stored same-origin result) so mock/local objects remain playable.
 */
export async function resolvePrivateDeliveryUrl(opts: {
  objectKey?: string | null;
  resultUrl?: string | null;
  expiresInSec?: number;
}): Promise<string | null> {
  const key = opts.objectKey?.trim() || "";
  if (key) {
    const signed = await createSignedGetUrl(key, opts.expiresInSec ?? 3600);
    if (signed) return signed;
    if (!isProductionRuntime()) {
      if (opts.resultUrl?.startsWith("/api/media/")) return opts.resultUrl;
      return localObjectMediaPath(key);
    }
    return null;
  }

  if (
    opts.resultUrl &&
    (opts.resultUrl.startsWith("/api/media/") || !isProductionRuntime())
  ) {
    return opts.resultUrl;
  }
  return null;
}

export function isObjectStorageConfigured(): boolean {
  return getObjectStorageClient() !== null;
}
