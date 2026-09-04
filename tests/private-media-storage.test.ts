import { S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteStoredObject,
  getObjectStorageClient,
  persistRemoteAsset,
} from "@/lib/storage/object-storage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubR2() {
  vi.stubEnv("R2_ACCOUNT_ID", "account");
  vi.stubEnv("R2_ACCESS_KEY_ID", "key");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
  vi.stubEnv("R2_BUCKET", "private-media");
  vi.stubEnv("R2_PUBLIC_URL", "https://public.example.test");
}

describe("private object storage", () => {
  it("stores objects without a public delivery URL even when one is configured", async () => {
    stubR2();
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({} as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("private video", {
          headers: { "content-type": "video/mp4" },
        })
      )
    );

    const client = getObjectStorageClient();
    expect(client).not.toHaveProperty("publicBase");

    const stored = await persistRemoteAsset({
      sourceUrl: "https://provider.example.test/output.mp4",
      userId: "user-1",
      generationId: "generation-1",
      kind: "video",
    });

    expect(stored).toMatchObject({
      provider: "r2",
      url: null,
    });
    expect(stored.key).toMatch(/^generations\/user-1\/generation-1\//);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("persists instant mock bytes without fetching HTTP", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const stored = await persistRemoteAsset({
      sourceUrl: "https://placehold.co/missing.mp4",
      userId: "user-1",
      generationId: "generation-mock",
      kind: "video",
      forceLocal: true,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(stored).toMatchObject({
      provider: "local",
    });
    expect(stored.key).toMatch(/^generations\/user-1\/generation-mock\//);
    expect(stored.url).toMatch(/^\/api\/media\/objects\/generations\//);
  });

  it("writes a local mock object in production without R2", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const stored = await persistRemoteAsset({
      sourceUrl: "/dev-mock/preview.mp4",
      userId: "user-1",
      generationId: "generation-prod-mock",
      kind: "video",
      forceLocal: true,
    });
    expect(stored.provider).toBe("local");
    expect(stored.key).toMatch(/^generations\/user-1\/generation-prod-mock\//);
  });

  it("deletes only a scoped generated object", async () => {
    stubR2();
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({} as never);

    await deleteStoredObject("generations/user-1/generation-1/asset.mp4");

    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0][0] as { input: unknown }).input).toMatchObject({
      Bucket: "private-media",
      Key: "generations/user-1/generation-1/asset.mp4",
    });
    await expect(deleteStoredObject("../outside.mp4")).rejects.toThrow(
      "Invalid stored object key"
    );
  });
});
