import { z } from "zod";

const finiteNumber = z.number().finite();

/** Direction, position, or color expressed in normalized three-dimensional space. */
export const vector3Schema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
});

export type Vector3 = z.infer<typeof vector3Schema>;

export const cameraMotionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("pan"),
    direction: vector3Schema,
    distance: z.number().positive().max(100).default(1),
  }),
  z.object({
    kind: z.literal("zoom"),
    direction: z.enum(["in", "out"]),
    amount: z.number().positive().max(10).default(1),
  }),
  z.object({
    kind: z.literal("orbit"),
    axis: vector3Schema,
    degrees: z.number().positive().max(360).default(45),
    radius: z.number().positive().max(100).default(1),
  }),
]);

export type CameraMotion = z.infer<typeof cameraMotionSchema>;

export const lightVectorSchema = z.object({
  /** A provider-neutral label, used only for prompt serialization. */
  role: z.enum(["key", "fill", "rim", "practical", "ambient"]),
  /** Unit-agnostic placement relative to the subject. */
  position: vector3Schema,
  /** Direction in which the light travels. */
  direction: vector3Schema,
  intensity: z.number().nonnegative().max(100_000).default(1),
  color: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, "Expected a hex color")
    .default("#ffffff"),
});

export type LightVector = z.infer<typeof lightVectorSchema>;

export const cameraLightingSchema = z.object({
  camera: cameraMotionSchema.optional(),
  lights: z.array(lightVectorSchema).max(8).default([]),
});

export type CameraLighting = z.infer<typeof cameraLightingSchema>;

const videoPayloadOptionsSchema = z.object({
  prompt: z.string().trim().min(1),
  negativePrompt: z.string().trim().optional(),
  imageUrl: z.string().url().optional(),
  durationSeconds: z.number().int().min(1).max(10).optional(),
  fps: z.number().int().min(1).max(60).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
  seed: z.number().int().nonnegative().optional(),
  cameraLighting: cameraLightingSchema.optional(),
});

export type VideoPayloadOptions = z.input<typeof videoPayloadOptionsSchema>;

type PreparedPrompt = Pick<
  z.infer<typeof videoPayloadOptionsSchema>,
  "prompt" | "cameraLighting"
>;

function formatVector(vector: Vector3): string {
  return `(${vector.x}, ${vector.y}, ${vector.z})`;
}

function formatCameraLightingPrompt(input: PreparedPrompt): string {
  const { prompt, cameraLighting } = input;
  if (!cameraLighting) return prompt;

  const camera = cameraLighting.camera;
  const cameraDirective = camera
    ? camera.kind === "pan"
      ? `camera pan toward ${formatVector(camera.direction)}, distance ${camera.distance}`
      : camera.kind === "zoom"
        ? `camera zoom ${camera.direction}, amount ${camera.amount}`
        : `camera orbit around axis ${formatVector(camera.axis)}, ${camera.degrees} degrees, radius ${camera.radius}`
    : "";

  const lightingDirectives = cameraLighting.lights.map(
    (light) =>
      `${light.role} light at ${formatVector(light.position)} toward ${formatVector(light.direction)}, intensity ${light.intensity}, color ${light.color}`
  );

  const directives = [cameraDirective, ...lightingDirectives].filter(Boolean);
  return directives.length > 0 ? `${prompt}. ${directives.join("; ")}.` : prompt;
}

/**
 * Fal.ai's Wan endpoint input. Camera and light controls are represented in the
 * prompt because Wan's public API has no portable structured equivalents.
 */
export type FalWan22Payload = {
  prompt: string;
  negative_prompt?: string;
  image_url?: string;
  num_frames?: number;
  frames_per_second?: number;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  seed?: number;
};

export function formatFalWan22Payload(options: VideoPayloadOptions): FalWan22Payload {
  const input = videoPayloadOptionsSchema.parse(options);
  const payload: FalWan22Payload = {
    prompt: formatCameraLightingPrompt(input),
  };
  if (input.negativePrompt) payload.negative_prompt = input.negativePrompt;
  if (input.imageUrl) payload.image_url = input.imageUrl;
  if (input.durationSeconds && input.fps) {
    payload.num_frames = input.durationSeconds * input.fps;
  }
  if (input.fps) payload.frames_per_second = input.fps;
  if (input.aspectRatio) payload.aspect_ratio = input.aspectRatio;
  if (input.seed !== undefined) payload.seed = input.seed;
  return payload;
}

/** Replicate's HunyuanVideo-compatible input shape. */
export type ReplicateHunyuanVideoPayload = {
  prompt: string;
  negative_prompt?: string;
  image?: string;
  video_length?: number;
  fps?: number;
  seed?: number;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
};

export function formatReplicateHunyuanVideoPayload(
  options: VideoPayloadOptions
): ReplicateHunyuanVideoPayload {
  const input = videoPayloadOptionsSchema.parse(options);
  const payload: ReplicateHunyuanVideoPayload = {
    prompt: formatCameraLightingPrompt(input),
  };
  if (input.negativePrompt) payload.negative_prompt = input.negativePrompt;
  if (input.imageUrl) payload.image = input.imageUrl;
  if (input.durationSeconds) payload.video_length = input.durationSeconds;
  if (input.fps) payload.fps = input.fps;
  if (input.aspectRatio) payload.aspect_ratio = input.aspectRatio;
  if (input.seed !== undefined) payload.seed = input.seed;
  return payload;
}
