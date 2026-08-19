import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getObjectStorageClient } from "@/lib/storage/object-storage";

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

export function isObjectStorageConfigured(): boolean {
  return getObjectStorageClient() !== null;
}
