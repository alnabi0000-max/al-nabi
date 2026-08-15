/**
 * Timeline audio NC math (run: npx tsx scripts/verify-timeline-audio.ts)
 */
import {
  AUDIO_CREDIT_RATES,
  calculateActiveAudioCost,
  calculateGenerationCost,
  calculateTtsClipCost,
  estimateSpeechDurationSec,
} from "../src/lib/credits";
import {
  calculateTimelineAudioCost,
  clampTimelineDuration,
  defaultTimelineClips,
  framesToSeconds,
  secondsToFrames,
  TIMELINE_FPS,
} from "../src/lib/studio/timeline";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

assert(AUDIO_CREDIT_RATES.ttsPerEightSec === 2, "TTS block = 2 NC");
assert(AUDIO_CREDIT_RATES.sfxPerClip === 1, "SFX clip = 1 NC");
assert(calculateTtsClipCost(0) === 0, "empty TTS is free");
assert(calculateTtsClipCost(8) === 2, "8s TTS = 2 NC");
assert(calculateTtsClipCost(9) === 4, "9s TTS = 2 blocks");
assert(estimateSpeechDurationSec("") === 0, "empty speech estimate");
assert(estimateSpeechDurationSec("one two three four five") > 0, "speech estimate");

assert(
  calculateActiveAudioCost([
    { kind: "bgm", muted: false, hasContent: true },
    { kind: "voice", muted: true, hasContent: true, durationSec: 8 },
  ]) === 0,
  "muted voice + BGM add 0"
);

assert(
  calculateActiveAudioCost([
    { kind: "voice", muted: false, hasContent: true, durationSec: 8 },
    { kind: "sfx", muted: false, hasContent: true },
    { kind: "bgm", muted: false, hasContent: true },
  ]) === 3,
  "voice 2 + sfx 1 + bgm 0 = 3"
);

const clips = defaultTimelineClips(10);
assert(calculateTimelineAudioCost(clips, "ai") === 0, "empty clips cost 0");
const voiced = clips.map((c) =>
  c.kind === "voice" ? { ...c, prompt: "A wide desert road at dusk" } : c
);
assert(calculateTimelineAudioCost(voiced, "ai") === 2, "voice prompt bills TTS");
assert(clampTimelineDuration(1) === 2, "min duration 2s");
assert(secondsToFrames(1, TIMELINE_FPS) === TIMELINE_FPS, "1s = fps frames");
assert(framesToSeconds(TIMELINE_FPS * 3) === 3, "3s from frames");

const video = calculateGenerationCost("prompt_to_video", 8);
assert(
  video === 30,
  "P2V formula unchanged when audio extras exist"
);

console.log("ALL TIMELINE AUDIO CHECKS PASSED");
