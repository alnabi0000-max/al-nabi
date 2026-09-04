import { existsSync, readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  ensureMockAssetPath,
  isValidMockAssetBytes,
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
    expect(isValidMockAssetBytes("image", readFileSync(image))).toBe(true);
    expect(isValidMockAssetBytes("video", readFileSync(video))).toBe(true);
  });

  it("exposes same-origin public paths, not GCS samples", () => {
    expect(mockPublicPath("image")).toBe("/dev-mock/preview.png");
    expect(mockPublicPath("video")).toBe("/dev-mock/preview.mp4");
    expect(mockAssetBytes("video").length).toBeLessThan(512);
    expect(mockAssetBytes("image").length).toBeLessThan(128);
    expect(isValidMockAssetBytes("image", mockAssetBytes("image"))).toBe(true);
    expect(isValidMockAssetBytes("video", mockAssetBytes("video"))).toBe(true);
  });

  it("keeps a valid on-disk fixture instead of rewriting it", () => {
    const image = ensureMockAssetPath("image");
    const before = readFileSync(image);
    const again = ensureMockAssetPath("image");
    expect(again).toBe(image);
    expect(readFileSync(image)).toEqual(before);
  });
});
