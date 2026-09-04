import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage/object-storage", () => ({
  getObjectStorageClient: () => null,
}));

import {
  localObjectMediaPath,
  resolvePrivateDeliveryUrl,
} from "@/lib/storage/signed-url";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("private delivery URLs", () => {
  it("builds a same-origin object path", () => {
    expect(localObjectMediaPath("generations/user/job/out.mp4")).toBe(
      "/api/media/objects/generations/user/job/out.mp4"
    );
  });

  it("falls back to the local media route when object storage is unset", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await expect(
      resolvePrivateDeliveryUrl({
        objectKey: "generations/user/job/out.mp4",
        resultUrl: null,
      })
    ).resolves.toBe("/api/media/objects/generations/user/job/out.mp4");
  });

  it("prefers a stored local media URL over reconstructing one", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await expect(
      resolvePrivateDeliveryUrl({
        objectKey: "generations/user/job/out.mp4",
        resultUrl: "/api/media/objects/generations/user/job/out.mp4",
      })
    ).resolves.toBe("/api/media/objects/generations/user/job/out.mp4");
  });

  it("does not leak a public provider URL in production without a signed object", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(
      resolvePrivateDeliveryUrl({
        objectKey: null,
        resultUrl: "https://provider.example.test/out.mp4",
      })
    ).resolves.toBeNull();
  });
});
