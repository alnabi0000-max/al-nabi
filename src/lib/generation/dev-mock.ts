/**
 * Local / test — darhol o‘ynaydigan mock media (Replicate kutmasdan).
 * Preview bytes live in mock-assets.ts — never fetch GCS or placehold.co.
 */

export {
  ensureMockAssetPath,
  isValidMockAssetBytes,
  mockAssetBytes,
  mockAssetsDir,
  mockContentType,
  mockPublicPath,
} from "@/lib/generation/mock-assets";

export function shouldInstantMockGenerate(): boolean {
  if (process.env.ALNABIY_FORCE_MOCK === "0") return false;
  if (process.env.ALNABIY_FORCE_MOCK === "1") return true;
  /* Hosted/CI production: never auto-mock a *paid* generation. */
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.ALNABIY_DEV_INSTANT_GENERATE === "1") return true;
  if (process.env.AUTH_MODE?.toLowerCase() === "local") return true;
  if (process.env.NEXT_PUBLIC_ALNABIY_MODE === "development") return true;
  return true;
}

/** Missing Replicate/Kling/Runway keys must not 503 while local mock is on. */
export function shouldRejectUnconfiguredProvider(configured: boolean): boolean {
  return !configured && !shouldInstantMockGenerate();
}

export function applyLocalMockAvailability<T extends { configured: boolean }>(
  value: T
): T & { localMock: boolean } {
  const localMock = shouldInstantMockGenerate();
  return {
    ...value,
    configured: value.configured || localMock,
    localMock,
  };
}
