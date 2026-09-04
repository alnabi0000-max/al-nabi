import { describe, expect, it } from "vitest";
import { sanitizeGenerationError } from "@/lib/generation/public-error";
import { friendlyApiError } from "@/lib/api-errors";

const tr = (key: string) => (key === "generate_failed" ? "Generatsiya muvaffaqiyatsiz" : key);

describe("sanitizeGenerationError", () => {
  it("maps ECONNRESET and socket hang ups to a stable public message", () => {
    expect(sanitizeGenerationError(new Error("read ECONNRESET"))).toBe(
      "Network reset while saving media. Credits refunded."
    );
    expect(sanitizeGenerationError("socket hang up")).toBe(
      "Network reset while saving media. Credits refunded."
    );
  });

  it("does not leak vendor URLs or keys", () => {
    const msg = sanitizeGenerationError(
      "replicate https://api.replicate.com/v1 failed bearer r8_abc123"
    );
    expect(msg).not.toMatch(/replicate|r8_|https?:\/\//i);
  });
});

describe("friendlyApiError", () => {
  it("shows the sanitized generate error instead of a generic toast", () => {
    expect(
      friendlyApiError(
        new Error("Network reset while saving media. Credits refunded."),
        tr
      )
    ).toBe("Network reset while saving media. Credits refunded.");
  });
});
