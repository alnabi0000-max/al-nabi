export type {
  BgmMode,
  BgmMood,
  BgmTrackMeta,
  BgmSelectionState,
} from "@/lib/bgm/types";
export {
  BGM_MODES,
  BGM_MOODS,
  DEFAULT_BGM_SELECTION,
} from "@/lib/bgm/types";
export {
  listAmbientTracks,
  pickAmbientTrack,
  resolveBgmMood,
  resolveBgmSelection,
  resolveTrackById,
} from "@/lib/bgm/catalog";
export {
  BGM_LINEAR_VOLUME,
  muxVideoWithAmbientBgm,
  renderAmbientBed,
} from "@/lib/bgm/mix";
