export type CameraMovement =
  | "static"
  | "zoom_in"
  | "zoom_out"
  | "pan_left"
  | "pan_right"
  | "tilt_up"
  | "tilt_down"
  | "slow_mo"
  | "orbit";

export type VideoStyle = "cinematic" | "cartoon" | "anime" | "realistic";

export interface Scene {
  index: number;
  visual_prompt: string;
  voice_text: string;
  camera_movement: CameraMovement;
  duration: number;
}

export interface ScriptAnalysisResult {
  title: string;
  total_duration: number;
  style: VideoStyle;
  scenes: Scene[];
}

export interface GenerateVideoInput {
  prompt: string;
  imageUrl?: string;
  durationSec?: number;
  cameraMove?: CameraMovement;
  style?: VideoStyle;
}
