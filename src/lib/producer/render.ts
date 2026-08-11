/**
 * Producer one-shot render: video + expressive VO + Foley → final MP4.
 * All engines exposed as Al-Nabi Native / Audio Engine.
 */

import path from "path";
import { enhancePromptWithIntent } from "@/lib/ai/prompt-enhancer";
import { generateVideoClip, CLIP_DURATION_SEC } from "@/lib/video-provider";
import { synthesizeSpeech } from "@/lib/audio";
import { muxVideoWithAudio } from "@/lib/ffmpeg-worker";
import { buildFoleyBed } from "@/lib/producer/foley";
import { ensureWorkDir, mixVoiceAndFoley } from "@/lib/producer/compose";
import type { VisualDna } from "@/lib/producer/vision-dna";
import type { EmotionMode } from "@/lib/credits";
import { ALNABIY_ENGINES } from "@/lib/models";

export type ProducerRenderInput = {
  brief: string;
  voiceScript?: string;
  aspect?: "16:9" | "9:16" | "1:1";
  narration?: EmotionMode;
  visualDna?: VisualDna | null;
  durationSec?: number;
  jobId?: string;
};

export type ProducerRenderResult = {
  ok: boolean;
  jobId: string;
  videoUrl: string | null;
  finalPath: string | null;
  voicePath: string | null;
  foleyCount: number;
  engine: string;
  audioEngine: string;
  promptUsed: string;
  error?: string;
};

function extractVoiceScript(brief: string, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim().slice(0, 2000);
  // Prefer quoted VO / last sentences
  const q = brief.match(/[“"]([^”"]{12,400})[”"]/);
  if (q?.[1]) return q[1].trim();
  const sentences = brief
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (sentences.slice(-2).join(" ") || brief).slice(0, 600);
}

export async function renderProducerPackage(
  input: ProducerRenderInput
): Promise<ProducerRenderResult> {
  const jobId =
    input.jobId || `prod_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const durationSec = Math.min(
    20,
    Math.max(5, input.durationSec || CLIP_DURATION_SEC)
  );
  const dnaAspect = input.visualDna?.aspectHint;
  const aspect: "16:9" | "9:16" | "1:1" =
    input.aspect ||
    (dnaAspect === "9:16" || dnaAspect === "1:1" || dnaAspect === "16:9"
      ? dnaAspect
      : "16:9");
  const narration = (input.narration || "epic") as EmotionMode;
  const workDir = await ensureWorkDir(jobId);

  try {
    const dnaFrag = input.visualDna?.promptDna
      ? `, ${input.visualDna.promptDna}`
      : "";
    const styleHint = /stickman|anime|voxel|gta|cartoon/i.test(
      input.visualDna?.artStyle || ""
    )
      ? "anime"
      : "cinematic";

    const enhanced = await enhancePromptWithIntent({
      prompt: `${input.brief}${dnaFrag}`,
      style: styleHint as "cinematic" | "anime",
      localeName: "English",
    });

    const clip = await generateVideoClip({
      prompt: enhanced.enhancedPrompt,
      aspect,
      durationSec,
      cameraMove: "zoom_in",
      quality: "1080p",
      engine: "auto",
    });

    const voiceText = extractVoiceScript(input.brief, input.voiceScript);
    const voicePath = path.join(workDir, "voice.mp3");
    const speech = await synthesizeSpeech({
      text: voiceText,
      outPath: voicePath,
      emotion: narration,
    });

    const foley = await buildFoleyBed({
      sceneText: `${input.brief}\n${voiceText}`,
      durationSec,
      outDir: path.join(workDir, "foley"),
    });

    const mixedPath = path.join(workDir, "mix.m4a");
    await mixVoiceAndFoley({
      voicePath: speech.audioPath,
      foley,
      outputPath: mixedPath,
      durationSec,
    });

    const finalPath = path.join(workDir, "final.mp4");
    await muxVideoWithAudio({
      videoPathOrUrl: clip.url,
      audioPath: mixedPath,
      outputPath: finalPath,
      durationSec,
    });

    return {
      ok: true,
      jobId,
      videoUrl: `/api/media/producer/${jobId}/final.mp4`,
      finalPath,
      voicePath: speech.audioPath,
      foleyCount: foley.length,
      engine: "Al-Nabi Native Engine",
      audioEngine: ALNABIY_ENGINES.voice || "Al-Nabi Audio Engine",
      promptUsed: enhanced.enhancedPrompt,
    };
  } catch (e) {
    return {
      ok: false,
      jobId,
      videoUrl: null,
      finalPath: null,
      voicePath: null,
      foleyCount: 0,
      engine: "Al-Nabi Native Engine",
      audioEngine: "Al-Nabi Audio Engine",
      promptUsed: input.brief,
      error: e instanceof Error ? e.message : "Produce failed",
    };
  }
}
