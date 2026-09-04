import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createHash, randomBytes } from "crypto";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";

export type StoredObject = {
  key: string;
  /**
   * A local development URL only. Persistent objects intentionally have no
   * browser-reachable URL; callers must request an owner-authorized signed URL.
   */
  url: string | null;
  provider: "r2" | "s3" | "local";
};

type ObjectStorageClient = {
  client: S3Client;
  bucket: string;
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

function normalizeObjectKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/");
  if (
    !normalized.startsWith("generations/") ||
    parts.some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error("Invalid stored object key");
  }
  return normalized;
}

/**
 * Physically removes a private generated asset. In production this operation
 * only targets the configured R2/S3 bucket; it never falls back to a web URL.
 */
export async function deleteStoredObject(key: string): Promise<void> {
  const normalizedKey = normalizeObjectKey(key);
  const s3 = getObjectStorageClient();
  if (s3) {
    await s3.client.send(
      new DeleteObjectCommand({
        Bucket: s3.bucket,
        Key: normalizedKey,
      })
    );
    return;
  }

  if (isProductionRuntime()) {
    throw new ObjectStorageConfigurationError();
  }

  const root = process.env.STORAGE_DIR || "./storage";
  const filePath = path.resolve(process.cwd(), root, "objects", normalizedKey);
  const objectRoot = path.resolve(process.cwd(), root, "objects");
  if (filePath !== objectRoot && !filePath.startsWith(objectRoot + path.sep)) {
    throw new Error("Invalid stored object key");
  }
  await rm(filePath, { force: true });
}

/**
 * Provider URL → private R2 / S3 object or local development disk.
 */
export async function persistRemoteAsset(opts: {
  sourceUrl: string;
  userId: string;
  generationId: string;
  kind: "image" | "video";
  /** Instant mock: never download HTTP and never upload to R2/S3. */
  forceLocal?: boolean;
}): Promise<StoredObject> {
  if (!opts.forceLocal) {
    assertPersistentObjectStorage();
  }

  let downloaded: Awaited<ReturnType<typeof fetchBytes>>;
  try {
    downloaded = await fetchBytes(opts.sourceUrl);
  } catch (error) {
    if (opts.forceLocal) {
      const { mockAssetBytes, mockContentType } = await import(
        "@/lib/generation/mock-assets"
      );
      downloaded = {
        buffer: mockAssetBytes(opts.kind),
        contentType: mockContentType(opts.kind),
      };
    } else if (isProductionRuntime()) {
      throw error;
    } else {
      // Placeholder/mock URLs can fail in local development. Never persist a
      // marker in production because it would masquerade as a completed asset.
      downloaded = {
        buffer: Buffer.from(
          `alnabiy-stub:${opts.generationId}:${opts.sourceUrl}`,
          "utf8"
        ),
        contentType:
          opts.kind === "image" ? "text/plain" : "application/octet-stream",
      };
    }
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

  const s3 = opts.forceLocal ? null : getObjectStorageClient();
  if (s3) {
    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return { key, url: null, provider: s3.provider };
  }

  return storeLocal(key, buffer);
}

export function isObjectStorageConfigured(): boolean {
  return getObjectStorageClient() !== null;
}
