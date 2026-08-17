import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";

const send = vi.hoisted(() => vi.fn());
const getSignedUrl = vi.hoisted(() =>
  vi.fn(async () => "https://signed.example/object")
);

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = send;
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl,
}));

import {
  assertPersistentObjectStorage,
  isPersistentObjectStorageConfigured,
  ObjectStorageConfigurationError,
  persistRemoteAsset,
} from "@/lib/storage/object-storage";
import { createSignedGetUrl } from "@/lib/storage/signed-url";
import { probeCoreHealth } from "@/lib/system/core";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

function stubR2() {
  vi.stubEnv("R2_ACCOUNT_ID", "acct");
  vi.stubEnv("R2_ACCESS_KEY_ID", "id");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
  vi.stubEnv("R2_BUCKET", "media");
  vi.stubEnv("R2_PUBLIC_URL", "https://cdn.example");
}

describe("object storage", () => {
  it("throws in production when R2/S3 credentials are missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isPersistentObjectStorageConfigured()).toBe(false);
    expect(() => assertPersistentObjectStorage()).toThrow(
      ObjectStorageConfigurationError
    );
  });

  it("accepts a full R2 credential set", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubR2();
    expect(isPersistentObjectStorageConfigured()).toBe(true);
    expect(() => assertPersistentObjectStorage()).not.toThrow();
    expect(probeCoreHealth().objectStorage).toBe(true);
  });

  it("accepts AWS_S3_BUCKET in addition to the legacy S3_BUCKET name", () => {
    vi.stubEnv("AWS_ACCESS_KEY_ID", "id");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "secret");
    vi.stubEnv("AWS_S3_BUCKET", "media");
    expect(isPersistentObjectStorageConfigured()).toBe(true);
  });

  it("persists local files in development when object storage is unset", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "alnabiy-storage-"));
    vi.stubEnv("STORAGE_DIR", tmp);
    const source = path.join(tmp, "clip.mp4");
    await fs.writeFile(source, Buffer.from("video-bytes"));

    const stored = await persistRemoteAsset({
      sourceUrl: source,
      userId: "user-1",
      generationId: "gen-1",
      kind: "video",
    });

    expect(stored.key).toBe("jobs/gen-1/result.mp4");
    expect(stored.url).toBe("/api/media/jobs/gen-1/result.mp4");
    const written = await fs.readFile(path.join(tmp, stored.key));
    expect(written.toString()).toBe("video-bytes");
    expect(send).not.toHaveBeenCalled();
  });

  it("uploads to R2 and returns the public URL when configured", async () => {
    stubR2();
    send.mockResolvedValue({});
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "alnabiy-storage-"));
    const source = path.join(tmp, "still.png");
    await fs.writeFile(source, Buffer.from("image-bytes"));

    const stored = await persistRemoteAsset({
      sourceUrl: source,
      userId: "user/1",
      generationId: "gen-9",
      kind: "image",
    });

    expect(stored.key).toBe("generations/user_1/gen-9/image.png");
    expect(stored.url).toBe(
      "https://cdn.example/generations/user_1/gen-9/image.png"
    );
    expect(send).toHaveBeenCalledOnce();
  });

  it("creates a signed GET URL for a stored key", async () => {
    stubR2();
    await expect(createSignedGetUrl("generations/u/g/video.mp4", 120)).resolves.toBe(
      "https://signed.example/object"
    );
    expect(getSignedUrl).toHaveBeenCalledOnce();
  });

  it("returns null from createSignedGetUrl when storage is not configured", async () => {
    await expect(createSignedGetUrl("generations/u/g/video.mp4")).resolves.toBe(
      null
    );
  });
});
