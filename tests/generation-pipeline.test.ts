import { describe, expect, it } from "vitest";
import {
  classifyGenerationFailure,
  isRecoverableLocalMockFailure,
  localFallbackMedia,
  publicGenerationError,
} from "@/lib/generation/pipeline";
import { friendlyApiError } from "@/lib/api-errors";

const tr = (key: string) =>
  key === "generate_failed" ? "Generatsiya muvaffaqiyatsiz" : key;

describe("generation pipeline errors", () => {
  it("classifies persist and network failures with a stage + code", () => {
    expect(classifyGenerationFailure(new Error("read ECONNRESET"))).toEqual({
      message: "Network reset while saving media. Credits refunded.",
      code: "NETWORK_RESET",
      stage: "mock-persist",
    });
    expect(
      classifyGenerationFailure("Failed to persist object storage", "queue")
    ).toMatchObject({
      code: "MOCK_PERSIST_FAILED",
      stage: "mock-persist",
    });
  });

  it("returns CODE: exact message for the Studio toast", () => {
    expect(
      publicGenerationError({
        error: "Network reset while saving media. Credits refunded.",
        errorCode: "NETWORK_RESET",
      })
    ).toBe("NETWORK_RESET: Network reset while saving media. Credits refunded.");
  });

  it("does not genericize a structured generation error", () => {
    expect(
      friendlyApiError(
        new Error("NETWORK_RESET: Network reset while saving media. Credits refunded."),
        tr
      )
    ).toBe("NETWORK_RESET: Network reset while saving media. Credits refunded.");
  });

  it("recovers mock persist hiccups to the local placeholder", () => {
    expect(isRecoverableLocalMockFailure("MOCK_PERSIST_FAILED")).toBe(true);
    expect(localFallbackMedia("video")).toBe("/dev-mock/preview.mp4");
  });
});
