import { existsSync, readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  ensureMockAssetPath,
  mockAssetBytes,
  mockPublicPath,
} from "@/lib/generation/mock-assets";

describe("local generation mock assets", () => {
  it("never returns an http(s) source for persist", () => {
    const image = ensureMockAssetPath("image");
    const video = ensureMockAssetPath("video");

    expect(image).not.toMatch(/^https?:\/\//i);
    expect(video).not.toMatch(/^https?:\/\//i);
    expect(image).toMatch(/preview\.png$/);
    expect(video).toMatch(/preview\.mp4$/);
    expect(existsSync(image)).toBe(true);
    expect(existsSync(video)).toBe(true);
    expect(readFileSync(image)).toEqual(mockAssetBytes("image"));
    expect(readFileSync(video)).toEqual(mockAssetBytes("video"));
  });

  it("exposes same-origin public paths, not GCS samples", () => {
    expect(mockPublicPath("image")).toBe("/dev-mock/preview.png");
    expect(mockPublicPath("video")).toBe("/dev-mock/preview.mp4");
    expect(mockAssetBytes("video").length).toBeLessThan(512);
    expect(mockAssetBytes("image").length).toBeLessThan(128);
  });
});
