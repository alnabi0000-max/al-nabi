import { afterEach, describe, expect, it, vi } from "vitest";

const isReplicateConfigured = vi.hoisted(() => vi.fn(() => true));
const generateReplicateVideo = vi.hoisted(() => vi.fn());

vi.mock("@/lib/replicate", () => ({
  isReplicateConfigured,
  generateReplicateVideo,
  getReplicateVideoModel: (engine: string) => `replicate/${engine}`,
}));

import {
  dispatchVideoWithProvider,
  getVideoGenerationEstimate,
} from "@/lib/ai/provider-registry";

afterEach(() => {
  vi.clearAllMocks();
  isReplicateConfigured.mockReturnValue(true);
});

describe("provider capability registry", () => {
  it("keeps a direct Runway request fail-closed instead of mapping it to Kling", async () => {
    const estimate = getVideoGenerationEstimate({
      engine: "runway-gen3",
      durationSec: 10,
      quality: "1080p",
    });

    expect(estimate).toMatchObject({
      engineId: "runway-gen3",
      commercialRoute: "direct",
      configured: false,
      endpointModel: null,
    });
    await expect(
      dispatchVideoWithProvider({
        prompt: "A film still",
        engine: "runway-gen3",
        durationSec: 10,
        quality: "1080p",
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ADAPTER_UNAVAILABLE",
    });
    expect(generateReplicateVideo).not.toHaveBeenCalled();
  });

  it("requires configured Replicate credentials before dispatch", async () => {
    isReplicateConfigured.mockReturnValue(false);

    await expect(
      dispatchVideoWithProvider({
        prompt: "A mountain lake at sunrise",
        engine: "kling-v3",
        durationSec: 15,
        quality: "1080p",
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_NOT_CONFIGURED",
    });
    expect(generateReplicateVideo).not.toHaveBeenCalled();
  });

  it("rejects controls absent from the configured endpoint capability", () => {
    expect(() =>
      getVideoGenerationEstimate({
        engine: "luma-ray2",
        durationSec: 10,
        quality: "1080p",
        imageUrl: "https://example.test/first.jpg",
        endImageUrl: "https://example.test/last.jpg",
      })
    ).toThrow(/last-frame input/);
  });

  it("rejects deterministic cinematic controls before provider dispatch", () => {
    expect(() =>
      getVideoGenerationEstimate({
        engine: "kling-v3",
        durationSec: 10,
        quality: "1080p",
        cinematicControls: { seed: 42 },
      })
    ).toThrow(/deterministic seed controls/);
    expect(generateReplicateVideo).not.toHaveBeenCalled();
  });

  it("estimates the actual supported MiniMax duration and customer price", () => {
    const estimate = getVideoGenerationEstimate({
      engine: "minimax",
      durationSec: 15,
      quality: "1080p",
    });

    expect(estimate.effectiveDurationSec).toBe(6);
    expect(estimate.durationAdjusted).toBe(true);
    expect(estimate.estimatedCredits).toBe(20);
    expect(estimate.estimatedProviderCostUsd).toBeNull();
  });
});
