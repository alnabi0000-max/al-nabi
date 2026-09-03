/**
 * Cloud Vault — Cloudflare R2 or AWS S3.
 *
 * Production generations must land in object storage: a serverless local disk
 * disappears after the invocation. Development may fall back to STORAGE_DIR.
 */

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import {
  isPlaceholderEnvValue,
  shouldEnforceProductionSecrets,
} from "@/lib/env";

export class ObjectStorageConfigurationError extends Error {
  readonly code = "OBJECT_STORAGE_UNAVAILABLE" as const;

  constructor(
    message = "Cloud Vault (R2 or S3) must be configured in production"
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

export type PersistRemoteAssetResult = {
  url: string;
  key: string;
};

type ObjectStorageConfig = {
  client: S3Client;
  bucket: string;
  publicBase: string;
};

function env(name: string): string {
  return process.env[name]?.trim() || "";
}

function live(name: string): string {
  const value = env(name);
  return isPlaceholderEnvValue(value) ? "" : value;
}

function r2Configured(): boolean {
  return Boolean(
    live("R2_ACCOUNT_ID") &&
      live("R2_ACCESS_KEY_ID") &&
      live("R2_SECRET_ACCESS_KEY") &&
      live("R2_BUCKET")
  );
}

function s3Configured(): boolean {
  return Boolean(
    live("AWS_ACCESS_KEY_ID") &&
      live("AWS_SECRET_ACCESS_KEY") &&
      (live("AWS_S3_BUCKET") || live("S3_BUCKET"))
  );
}

export function isObjectStorageConfigured(): boolean {
  return r2Configured() || s3Configured();
}

export function assertPersistentObjectStorage(): void {
  if (isObjectStorageConfigured()) return;
  if (shouldEnforceProductionSecrets()) {
    throw new ObjectStorageConfigurationError();
  }
}

function objectStorageConfig(): ObjectStorageConfig | null {
  if (r2Configured()) {
    const accountId = live("R2_ACCOUNT_ID");
    return {
      client: new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: live("R2_ACCESS_KEY_ID"),
          secretAccessKey: live("R2_SECRET_ACCESS_KEY"),
        },
      }),
      bucket: live("R2_BUCKET"),
      publicBase: live("R2_PUBLIC_URL").replace(/\/+$/, ""),
    };
  }

  if (s3Configured()) {
    return {
      client: new S3Client({
        region: live("AWS_REGION") || "us-east-1",
        credentials: {
          accessKeyId: live("AWS_ACCESS_KEY_ID"),
          secretAccessKey: live("AWS_SECRET_ACCESS_KEY"),
        },
      }),
      bucket: live("AWS_S3_BUCKET") || live("S3_BUCKET"),
      publicBase: live("AWS_S3_PUBLIC_URL").replace(/\/+$/, ""),
    };
  }

  return null;
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 128) || "unknown";
}

function extensionFor(kind: "image" | "video", sourceUrl: string): string {
  const match = /\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/.exec(sourceUrl);
  const ext = match?.[1]?.toLowerCase();
  if (kind === "image") {
    if (ext && ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return ext;
    return "png";
  }
  if (ext && ["mp4", "webm", "mov", "m4v"].includes(ext)) return ext;
  return "mp4";
}

function contentTypeFor(kind: "image" | "video", ext: string): string {
  if (kind === "image") {
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "webp") return "image/webp";
    if (ext === "gif") return "image/gif";
    return "image/png";
  }
  if (ext === "webm") return "video/webm";
  return "video/mp4";
}

function objectKey(
  input: PersistRemoteAssetInput,
  ext: string
): string {
  return `users/${safeSegment(input.userId)}/generations/${safeSegment(
    input.generationId
  )}/${input.kind}.${ext}`;
}

function isRemoteUrl(source: string): boolean {
  return /^https?:\/\//i.test(source);
}

async function readSourceBuffer(sourceUrl: string): Promise<Buffer> {
  if (isRemoteUrl(sourceUrl)) {
    const res = await fetch(sourceUrl, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Failed to download asset (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  const filePath = sourceUrl.startsWith("file://")
    ? sourceUrl.slice("file://".length)
    : sourceUrl;
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new Error("Asset source is not a file");
  }
  return readFile(filePath);
}

function publicOrSignedUrl(
  cfg: ObjectStorageConfig,
  key: string,
  signed: string | null
): string {
  if (cfg.publicBase) return `${cfg.publicBase}/${key}`;
  if (signed) return signed;
  return key;
}

export async function createSignedGetUrl(
  objectKeyValue: string,
  expiresInSec = 3600
): Promise<string | null> {
  const cfg = objectStorageConfig();
  if (!cfg || !objectKeyValue) return null;
  const command = new GetObjectCommand({
    Bucket: cfg.bucket,
    Key: objectKeyValue,
  });
  return getSignedUrl(cfg.client, command, {
    expiresIn: Math.min(Math.max(expiresInSec, 60), 86_400),
  });
}

async function persistLocally(
  input: PersistRemoteAssetInput,
  ext: string,
  body: Buffer
): Promise<PersistRemoteAssetResult> {
  const root = process.env.STORAGE_DIR || "./storage";
  const dir = path.join(root, "jobs", safeSegment(input.generationId));
  await mkdir(dir, { recursive: true });
  const filename = `result.${ext}`;
  await writeFile(path.join(dir, filename), body);
  const key = `jobs/${safeSegment(input.generationId)}/${filename}`;
  return {
    key,
    url: `/api/media/${key}`,
  };
}

export async function persistRemoteAsset(
  input: PersistRemoteAssetInput
): Promise<PersistRemoteAssetResult> {
  const ext = extensionFor(input.kind, input.sourceUrl);
  const body = await readSourceBuffer(input.sourceUrl);
  const cfg = objectStorageConfig();

  if (!cfg) {
    if (shouldEnforceProductionSecrets()) {
      throw new ObjectStorageConfigurationError();
    }
    return persistLocally(input, ext, body);
  }

  const key = objectKey(input, ext);
  await cfg.client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentTypeFor(input.kind, ext),
      CacheControl: "private, max-age=31536000",
    })
  );

  const signed = cfg.publicBase
    ? null
    : await createSignedGetUrl(key, 3600);
  return {
    key,
    url: publicOrSignedUrl(cfg, key, signed),
  };
}
