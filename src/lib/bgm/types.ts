/**
 * Client-safe BGM types (no Node fs).
 *
 * Pricing policy: ambient BGM is included in the existing video NC cost —
 * never add a separate BGM charge (local FFmpeg only).
 */

export type BgmMood = "calm" | "epic" | "suspense" | "upbeat";

export const BGM_MOODS: BgmMood[] = ["calm", "epic", "suspense", "upbeat"];

/** AI auto-pick | user picks a track | no ambient music */
export type BgmMode = "ai" | "manual" | "off";

export const BGM_MODES: BgmMode[] = ["ai", "manual", "off"];

export type BgmTrackMeta = {
  /** Relative id e.g. "epic/heroic-rise.mp3" */
  id: string;
  mood: BgmMood;
  title: string;
  /** Public URL under /music/... */
  url: string;
};

export type BgmSelectionState = {
  mode: BgmMode;
  trackId: string | null;
};

export const DEFAULT_BGM_SELECTION: BgmSelectionState = {
  mode: "ai",
  trackId: null,
};
