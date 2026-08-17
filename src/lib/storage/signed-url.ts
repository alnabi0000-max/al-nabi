import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getObjectStorageClient } from "@/lib/storage/object-storage";

/**
 * Create a time-limited GET URL for a vault object. Returns null when
 * object storage is not configured so callers can fall back to a direct URL.
 */
export async function createSignedGetUrl(
  key: string,
  expiresIn = 3600
): Promise<string | null> {
  const trimmed = key.trim();
  if (!trimmed) return null;

  const storage = getObjectStorageClient();
  if (!storage) return null;

  try {
    return await getSignedUrl(
      storage.client,
      new GetObjectCommand({ Bucket: storage.bucket, Key: trimmed }),
      { expiresIn }
    );
  } catch {
    return null;
  }
}
