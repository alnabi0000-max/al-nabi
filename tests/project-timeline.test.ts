import { describe, expect, it } from "vitest";
import {
  assertTimelinePositions,
  assertTimelineSourceOwnership,
  timelineUpdateSchema,
} from "@/lib/projects/timeline";

function validTimeline() {
  return timelineUpdateSchema.parse({
    revision: 1,
    fps: 24,
    audioMix: {
      masterMuted: false,
      masterVolume: 1,
      musicVolume: 1,
      voiceVolume: 1,
    },
    tracks: [
      {
        position: 0,
        kind: "VIDEO",
        name: "Video",
        clips: [
          {
            position: 0,
            startMs: 0,
            durationMs: 5_000,
            sourceRenderVersionId: "owned-render",
          },
        ],
      },
    ],
  });
}

describe("project timeline validation", () => {
  it("rejects a source that is not owned by the selected project", () => {
    const timeline = validTimeline();

    expect(() =>
      assertTimelineSourceOwnership(timeline, {
        assets: [],
        renderVersions: [],
      })
    ).toThrow(/not owned by this project/);
  });

  it("rejects overlapping video clips before an export can be requested", () => {
    const timeline = validTimeline();
    timeline.tracks[0].clips.push({
      position: 1,
      startMs: 4_000,
      durationMs: 5_000,
      trimStartMs: 0,
      trimEndMs: 0,
      muted: false,
      volume: 1,
      sourceAssetId: "owned-video",
      sourceRenderVersionId: null,
      metadata: null,
    });

    expect(() => assertTimelinePositions(timeline)).toThrow(/may not overlap/);
  });
});
