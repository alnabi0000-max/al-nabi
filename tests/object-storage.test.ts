import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ObjectStorageConfigurationError,
  assertPersistentObjectStorage,
  isObjectStorageConfigured,
  persistRemoteAsset,
} from "@/lib/storage/object-storage";
import { createSignedGetUrl } from "@/lib/storage/signed-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("object storage configuration", () => {
  it("is off when R2/S3 keys are missing or placeholders", () => {
    vi.stubEnv("R2_ACCOUNT_ID", "");
    vi.stubEnv("R2_ACCESS_KEY_ID", "");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
    vi.stubEnv("R2_BUCKET", "");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "");
    vi.stubEnv("AWS_S3_BUCKET", "");
    vi.stubEnv("S3_BUCKET", "");
    expect(isObjectStorageConfigured()).toBe(false);
  });

  it("accepts a complete R2 credential set", () => {
    vi.stubEnv("R2_ACCOUNT_ID", "acct");
    vi.stubEnv("R2_ACCESS_KEY_ID", "key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
    vi.stubEnv("R2_BUCKET", "alnabi-media");
    expect(isObjectStorageConfigured()).toBe(true);
  });

  it("fails closed in production when Cloud Vault is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("CI", "");
    vi.stubEnv("R2_ACCOUNT_ID", "");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");
    expect(() => assertPersistentObjectStorage()).toThrow(
      ObjectStorageConfigurationError
    );
  });

  it("allows local disk during development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("R2_ACCOUNT_ID", "");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");
    expect(() => assertPersistentObjectStorage()).not.toThrow();
  });

  it("returns null signed URLs when the vault is not configured", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");
    expect(await createSignedGetUrl("users/x/generations/y/video.mp4")).toBeNull();
  });
});

describe("local vault fallback", () => {
  it("copies a local file into STORAGE_DIR when Cloud Vault is unset", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "alnabi-vault-"));
    const source = path.join(dir, "clip.mp4");
    await writeFile(source, Buffer.from("fake-mp4"));
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STORAGE_DIR", dir);
    vi.stubEnv("R2_ACCOUNT_ID", "");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");

    const stored = await persistRemoteAsset({
      sourceUrl: source,
      userId: "6b1f2c3d-0000-4000-a000-0123456789ab",
      generationId: "job_test",
      kind: "video",
    });

    expect(stored.key).toBe("jobs/job_test/result.mp4");
    expect(stored.url).toBe("/api/media/jobs/job_test/result.mp4");
  });
});
