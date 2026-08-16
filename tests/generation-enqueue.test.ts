import { afterEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
const isInngestConfigured = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/lib/inngest/client", () => ({
  assertInngestConfigured: vi.fn(),
  GENERATION_EVENT: "alnabiy/generation.requested",
  inngest: { send },
  isInngestConfigured,
  isProductionRuntime: vi.fn(() => false),
}));

import { enqueueGeneration } from "@/lib/generation/enqueue";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("generation queue", () => {
  it("publishes a configured generation to Inngest", async () => {
    send.mockResolvedValue({ ids: ["event-1"] });

    await expect(enqueueGeneration("generation-1")).resolves.toEqual({
      mode: "inngest",
    });
    expect(send).toHaveBeenCalledWith({
      name: "alnabiy/generation.requested",
      data: { generationId: "generation-1" },
    });
    expect(isInngestConfigured).toHaveBeenCalledOnce();
  });
});
