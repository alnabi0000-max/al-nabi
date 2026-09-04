import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyLocalMockAvailability,
  shouldInstantMockGenerate,
  shouldRejectUnconfiguredProvider,
} from "@/lib/generation/dev-mock";
import { isRecoverableLocalMockFailure } from "@/lib/generation/pipeline";
import {
  isSuccessfulGenerateResponse,
  type GenerateQueuedResponse,
} from "@/lib/generation/types";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("local mock generation gate", () => {
  it("enables instant mock in development without provider keys", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALNABIY_FORCE_MOCK", "");
    expect(shouldInstantMockGenerate()).toBe(true);
    expect(shouldRejectUnconfiguredProvider(false)).toBe(false);
  });

  it("rejects missing keys in production unless mock is forced", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALNABIY_FORCE_MOCK", "");
    expect(shouldInstantMockGenerate()).toBe(false);
    expect(shouldRejectUnconfiguredProvider(false)).toBe(true);

    vi.stubEnv("ALNABIY_FORCE_MOCK", "1");
    expect(shouldInstantMockGenerate()).toBe(true);
    expect(shouldRejectUnconfiguredProvider(false)).toBe(false);
  });

  it("marks capabilities executable when local mock is on", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALNABIY_FORCE_MOCK", "");
    expect(
      applyLocalMockAvailability({
        configured: false,
        commercialRoute: "replicate",
      })
    ).toMatchObject({ configured: true, localMock: true });
  });

  it("completes a recovered mock payload as success", () => {
    const data: GenerateQueuedResponse = {
      ok: true,
      status: "COMPLETED",
      done: true,
      instantMock: true,
      recovered: true,
      resultUrl: "/dev-mock/preview.mp4",
      videoUrl: "/dev-mock/preview.mp4",
    };
    expect(isSuccessfulGenerateResponse(data)).toBe(true);
    expect(isRecoverableLocalMockFailure("NETWORK_RESET")).toBe(true);
    expect(isRecoverableLocalMockFailure("CHARGE_FAILED")).toBe(false);
  });
});
