import { describe, expect, it } from "vitest";
import {
  initialExportStatus,
  validateExportSnapshot,
  type TimelineExportSnapshot,
} from "@/lib/projects/export";

const validSnapshot: TimelineExportSnapshot = {
  revision: 2,
  fps: 24,
  durationMs: 5_000,
  audioMix: {
    masterMuted: false,
    masterVolume: 1,
    musicVolume: 1,
    voiceVolume: 1,
  },
  tracks: [
    {
      id: "video-track",
      kind: "VIDEO",
      name: "Video",
      position: 0,
      muted: false,
      volume: 1,
      clips: [
        {
          id: "clip-1",
          position: 0,
          startMs: 0,
          durationMs: 5_000,
          trimStartMs: 0,
          trimEndMs: 0,
          muted: false,
          volume: 1,
          source: {
            id: "render-1",
            type: "render_version",
            objectKey: "generations/user/render-1.mp4",
            label: "Render v1",
          },
        },
      ],
    },
  ],
};

describe("project export state semantics", () => {
  it("stays configuration-required instead of claiming a completed export", () => {
    expect(initialExportStatus({ configured: false })).toBe(
      "CONFIGURATION_REQUIRED"
    );
    expect(initialExportStatus({ configured: true })).toBe("QUEUED");
  });

  it("requires a private persisted source before a configured worker can run", () => {
    const missingPrivateSource = structuredClone(validSnapshot);
    missingPrivateSource.tracks[0].clips[0].source.objectKey = null;

    expect(() => validateExportSnapshot(missingPrivateSource, true)).toThrow(
      /private project media/
    );
    expect(() => validateExportSnapshot(validSnapshot, true)).not.toThrow();
  });
});
