/**
 * Persistent object storage (Cloudflare R2 or AWS S3).
 *
 * Production generation must land in durable object storage — local
 * STORAGE_DIR is ephemeral on serverless runtimes. Development may fall
 * back to STORAGE_DIR and /api/media/... URLs.
 */

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs/promises";
import path from "path";

export class ObjectStorageConfigurationError extends Error {
  constructor(
    message = "Persistent object storage is required for production media. Configure a full R2 or S3 credential set."
  ) {
    super(message);
    this.name = "ObjectStorageConfigurationError";
  }
}

export type PersistRemoteAssetInput = {
  sourceUrl: string;
  userId: string;
  generationId: string;
  kind: "image" | "video";
};

export type PersistedAsset = {
  url: string;
  key: string;
};

export type ObjectStorageClient = {
  client: S3Client;
  bucket: string;
  publicBaseUrl: string | null;
};

function configured(value: string | undefined | null): boolean {
  return Boolean(value?.trim());
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function r2Configured(): boolean {
  return (
    configured(process.env.R2_ACCOUNT_ID) &&
    configured(process.env.R2_ACCESS_KEY_ID) &&
    configured(process.env.R2_SECRET_ACCESS_KEY) &&
    configured(process.env.R2_BUCKET)
  );
}

function s3BucketName(): string | undefined {
  return process.env.AWS_S3_BUCKET?.trim() || process.env.S3_BUCKET?.trim();
}

function s3Configured(): boolean {
  return (
    configured(process.env.AWS_ACCESS_KEY_ID) &&
    configured(process.env.AWS_SECRET_ACCESS_KEY) &&
    configured(s3BucketName())
  );
}

export function isPersistentObjectStorageConfigured(): boolean {
  return r2Configured() || s3Configured();
}

export function isObjectStorageConfigured(): boolean {
  return isPersistentObjectStorageConfigured();
}

export function assertPersistentObjectStorage(): void {
  if (isProductionRuntime() && !isPersistentObjectStorageConfigured()) {
    throw new ObjectStorageConfigurationError();
  }
}

function safeSegment(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned || "unknown";
}

function extensionFor(kind: "image" | "video", sourceUrl: string): string {
  const pathname = sourceUrl.split("?")[0] || "";
  const ext = path.extname(pathname).toLowerCase();
  if (
    [
      ".mp4",
      ".webm",
      ".mov",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".gif",
    ].includes(ext)
  ) {
    return ext;
  }
  return kind === "image" ? ".png" : ".mp4";
}

function contentTypeFor(kind: "image" | "video", ext: string): string {
  switch (ext) {
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mov":
      return "video/quicktime";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return kind === "image" ? "image/png" : "video/mp4";
  }
}

function objectKey(
  userId: string,
  generationId: string,
  kind: "image" | "video",
  ext: string
): string {
  return `generations/${safeSegment(userId)}/${safeSegment(generationId)}/${kind}${ext}`;
}

export function getObjectStorageClient(): ObjectStorageClient | null {
  if (r2Configured()) {
    const accountId = process.env.R2_ACCOUNT_ID!.trim();
    const config: S3ClientConfig = {
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
      },
    };
    return {
      client: new S3Client(config),
      bucket: process.env.R2_BUCKET!.trim(),
      publicBaseUrl: process.env.R2_PUBLIC_URL?.trim() || null,
    };
  }

  const bucket = s3BucketName();
  if (s3Configured() && bucket) {
    const config: S3ClientConfig = {
      region: process.env.AWS_REGION?.trim() || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
      },
    };
    return {
      client: new S3Client(config),
      bucket,
      publicBaseUrl:
        process.env.AWS_S3_PUBLIC_URL?.trim() ||
        process.env.S3_PUBLIC_URL?.trim() ||
        null,
    };
  }

  return null;
}

function publicUrlFor(base: string, key: string): string {
  const encoded = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${base.replace(/\/$/, "")}/${encoded}`;
}

async function readSourceBytes(sourceUrl: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(sourceUrl)) {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch generated asset (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  const filePath = sourceUrl.startsWith("file:")
    ? new URL(sourceUrl).pathname
    : sourceUrl;
  return fs.readFile(filePath);
}

async function persistLocally(opts: {
  bytes: Buffer;
  generationId: string;
  ext: string;
}): Promise<PersistedAsset> {
  const root = process.env.STORAGE_DIR || "./storage";
  const relative = path.posix.join(
    "jobs",
    safeSegment(opts.generationId),
    `result${opts.ext}`
  );
  const dest = path.join(root, relative);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, opts.bytes);
  return {
    url: `/api/media/${relative}`,
    key: relative,
  };
}

export async function persistRemoteAsset(
  opts: PersistRemoteAssetInput
): Promise<PersistedAsset> {
  if (!opts.sourceUrl) {
    throw new Error("Cannot persist an empty asset source");
  }

  const ext = extensionFor(opts.kind, opts.sourceUrl);
  const contentType = contentTypeFor(opts.kind, ext);
  const bytes = await readSourceBytes(opts.sourceUrl);
  const storage = getObjectStorageClient();

  if (storage) {
    const key = objectKey(opts.userId, opts.generationId, opts.kind, ext);
    await storage.client.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      })
    );

    if (storage.publicBaseUrl) {
      return { url: publicUrlFor(storage.publicBaseUrl, key), key };
    }

    const signed = await getSignedUrl(
      storage.client,
      new GetObjectCommand({ Bucket: storage.bucket, Key: key }),
      { expiresIn: 3600 }
    );
    return { url: signed, key };
  }

  if (isProductionRuntime()) {
    throw new ObjectStorageConfigurationError();
  }

  return persistLocally({
    bytes,
    generationId: opts.generationId,
    ext,
  });
}
