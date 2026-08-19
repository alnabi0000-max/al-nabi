import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createHash, randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export type StoredObject = {
  key: string;
  url: string;
  provider: "r2" | "s3" | "local";
};

type ObjectStorageClient = {
  client: S3Client;
  bucket: string;
  publicBase: string;
  provider: "r2" | "s3";
};

const isProductionRuntime = () => process.env.NODE_ENV === "production";

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function getObjectStorageClient(): ObjectStorageClient | null {
  const r2AccountId = process.env.R2_ACCOUNT_ID?.trim();
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const r2Bucket = process.env.R2_BUCKET?.trim();
  const r2Configured =
    configured(process.env.R2_ACCOUNT_ID) ||
    configured(process.env.R2_ACCESS_KEY_ID) ||
    configured(process.env.R2_SECRET_ACCESS_KEY) ||
    configured(process.env.R2_BUCKET);

  if (r2Configured) {
    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2Bucket) {
      return null;
    }
    return {
      provider: "r2",
      bucket: r2Bucket,
      publicBase: (process.env.R2_PUBLIC_URL || "").replace(/\/$/, ""),
      client: new S3Client({
        region: "auto",
        endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: r2AccessKeyId,
          secretAccessKey: r2SecretAccessKey,
        },
      }),
    };
  }

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.AWS_S3_BUCKET?.trim() || process.env.S3_BUCKET?.trim();
  if (!accessKeyId || !secretAccessKey || !bucket) return null;

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  return {
    provider: "s3",
    bucket,
    publicBase: (
      process.env.AWS_S3_PUBLIC_URL ||
      process.env.S3_PUBLIC_URL ||
      `https://${bucket}.s3.${region}.amazonaws.com`
    ).replace(/\/$/, ""),
    client: new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

export class ObjectStorageConfigurationError extends Error {
  constructor() {
    super(
      "Persistent object storage is required in production. Configure a complete R2 or S3 credential set."
    );
    this.name = "ObjectStorageConfigurationError";
  }
}

/**
 * Production media must survive the serverless request/runtime. The local disk
 * fallback remains available only for development and test workflows.
 */
export function assertPersistentObjectStorage(): void {
  if (isProductionRuntime() && !getObjectStorageClient()) {
    throw new ObjectStorageConfigurationError();
  }
}

function guessContentType(urlOrName: string, fallback?: string): string {
  const lower = urlOrName.toLowerCase();
  if (lower.includes(".png") || lower.includes("image/png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  if (lower.includes(".mp4") || lower.includes("video/mp4")) return "video/mp4";
  if (lower.includes(".webm")) return "video/webm";
  return fallback || "application/octet-stream";
}

function extForContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webm")) return "webm";
  if (ct.includes("mp4") || ct.includes("video")) return "mp4";
  return "bin";
}

async function fetchBytes(sourceUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  /* Local absolute/relative path from FFmpeg mux (BGM overlay) */
  if (
    !sourceUrl.startsWith("http://") &&
    !sourceUrl.startsWith("https://") &&
    !sourceUrl.startsWith("/api/")
  ) {
    const { readFile } = await import("fs/promises");
    const buffer = await readFile(sourceUrl);
    return {
      buffer,
      contentType: guessContentType(sourceUrl, "video/mp4"),
    };
  }

  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Failed to download asset: ${res.status}`);
  }
  const contentType =
    res.headers.get("content-type") || guessContentType(sourceUrl);
  const ab = await res.arrayBuffer();
  return { buffer: Buffer.from(ab), contentType };
}

async function storeLocal(
  key: string,
  buffer: Buffer
): Promise<StoredObject> {
  assertPersistentObjectStorage();
  const root = process.env.STORAGE_DIR || "./storage";
  const full = path.join(process.cwd(), root, "objects", key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buffer);
  return {
    key,
    url: `/api/media/objects/${key.split(path.sep).join("/")}`,
    provider: "local",
  };
}

/**
 * Provider URL → R2 / S3 / local disk.
 */
export async function persistRemoteAsset(opts: {
  sourceUrl: string;
  userId: string;
  generationId: string;
  kind: "image" | "video";
}): Promise<StoredObject> {
  assertPersistentObjectStorage();

  let downloaded: Awaited<ReturnType<typeof fetchBytes>>;
  try {
    downloaded = await fetchBytes(opts.sourceUrl);
  } catch (error) {
    if (isProductionRuntime()) {
      throw error;
    }

    // Placeholder/mock URLs can fail in local development. Never persist a
    // marker in production because it would masquerade as a completed asset.
    downloaded = {
      // placehold / mock URLs sometimes fail CORS-less — store stub marker
      buffer: Buffer.from(
        `alnabiy-stub:${opts.generationId}:${opts.sourceUrl}`,
        "utf8"
      ),
      contentType:
        opts.kind === "image" ? "text/plain" : "application/octet-stream",
    };
  }
  const { buffer, contentType } = downloaded;

  const hash = createHash("sha256")
    .update(opts.generationId)
    .update(randomBytes(4))
    .digest("hex")
    .slice(0, 12);
  const ext = extForContentType(
    contentType || guessContentType(opts.sourceUrl, opts.kind === "image" ? "image/png" : "video/mp4")
  );
  const key = `generations/${opts.userId}/${opts.generationId}/${hash}.${ext}`;

  const s3 = getObjectStorageClient();
  if (s3) {
    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    const url = s3.publicBase
      ? `${s3.publicBase}/${key}`
      : `s3://${s3.bucket}/${key}`;
    return { key, url, provider: s3.provider };
  }

  return storeLocal(key, buffer);
}

export function isObjectStorageConfigured(): boolean {
  return getObjectStorageClient() !== null;
}
