/**
 * Local / test — darhol o‘ynaydigan mock media (Replicate kutmasdan).
 */

export function shouldInstantMockGenerate(): boolean {
  if (process.env.ALNABIY_FORCE_MOCK === "0") return false;
  if (process.env.ALNABIY_FORCE_MOCK === "1") return true;
  /* Production: never auto-mock a *paid* generation, no matter how AUTH_MODE
   * or other dev flags are set — this must be an explicit opt-in per request
   * above (ALNABIY_FORCE_MOCK=1), never an accidental side-effect of AUTH_MODE. */
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.ALNABIY_DEV_INSTANT_GENERATE === "1") return true;
  if (process.env.AUTH_MODE?.toLowerCase() === "local") return true;
  if (process.env.NEXT_PUBLIC_ALNABIY_MODE === "development") return true;
  return true;
}

/** Brauzerda ishonchli o‘ynaydigan qisqa namuna mp4 */
export const MOCK_VIDEO_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

export const MOCK_IMAGE_URL =
  "https://placehold.co/1280x720/0d0f12/00d4ff/png?text=Alnabiy+Dev+Preview";
