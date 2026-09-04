import { describe, expect, it } from "vitest";
import { resolveGenerationType } from "@/lib/generation/types";

describe("resolveGenerationType", () => {
  it("maps stills to IMAGE", () => {
    expect(resolveGenerationType({ mediaKind: "image" })).toBe("IMAGE");
  });

  it("maps a prompt-only clip to TEXT_TO_VIDEO", () => {
    expect(resolveGenerationType({ mediaKind: "video" })).toBe("TEXT_TO_VIDEO");
  });

  it("maps a first or last frame to IMAGE_TO_VIDEO", () => {
    expect(
      resolveGenerationType({ mediaKind: "video", imageUrl: "https://x/a.png" })
    ).toBe("IMAGE_TO_VIDEO");
    expect(
      resolveGenerationType({ mediaKind: "video", endImageUrl: "https://x/b.png" })
    ).toBe("IMAGE_TO_VIDEO");
  });
});
