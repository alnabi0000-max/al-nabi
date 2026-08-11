/**
 * Text & Prompt Enrichment — OpenRouter ONLY (single API key).
 * Video prompts → intent-preserving enhancer (Claude 3.5 Sonnet).
 */

import type { ScriptAnalysisResult, VideoStyle } from "./types";
import {
  AlnabiyCoreEngine,
  type AdvancedPromptOutput,
  type PromptAnalysisInput,
} from "@/lib/core-engine";
import { AlnabiySentinelEngine } from "@/lib/sentinel-engine";
import { AlnabiyNextGenEngine } from "@/lib/nextgen-engine";
import {
  createOpenRouterClient,
  getOpenRouterModel,
  openRouterChat,
} from "@/lib/ai/openrouter";
import { enhancePromptWithIntent } from "@/lib/ai/prompt-enhancer";

export class SentinelBlockedError extends Error {
  code = "SENTINEL_BLOCKED" as const;
  constructor(message: string) {
    super(message);
    this.name = "SentinelBlockedError";
  }
}

function styleToGenre(style: VideoStyle): PromptAnalysisInput["genre"] {
  if (style === "realistic") return "documentary";
  if (style === "cartoon" || style === "anime") return "sci-fi";
  return "cinematic";
}

/**
 * Intent-aware enhance for video/image prompts.
 * OpenRouter Claude 3.5 Sonnet — multilingual + Stickman/GTA/Photoreal rules.
 */
export async function enhancePromptDetailed(
  prompt: string,
  style: VideoStyle = "cinematic",
  localeName = "English"
): Promise<
  AdvancedPromptOutput & {
    sentinel: ReturnType<typeof AlnabiySentinelEngine.processInput>;
    nextGen: ReturnType<typeof AlnabiyNextGenEngine.processExcellencePipeline>;
    enhanceMode?: string;
    detectedStyle?: string | null;
    language?: string;
    engine?: string;
  }
> {
  const sentinel = AlnabiySentinelEngine.processInput(prompt);
  if (!sentinel.isSafe) {
    throw new SentinelBlockedError(
      sentinel.rejectionReason || "Content blocked by Alnabiy Sentinel"
    );
  }

  const intent = await enhancePromptWithIntent({
    prompt: sentinel.renderPrompt || prompt,
    style,
    localeName,
  });

  /* Metadata only — enhancedPrompt from intent layer is authoritative */
  const core = AlnabiyCoreEngine.generateMasterPrompt({
    userPrompt: intent.enhancedPrompt,
    genre: styleToGenre(
      intent.mode === "preserve_style" &&
        (style === "realistic" || style === "cinematic")
        ? "cartoon"
        : style
    ),
  });

  const allowSkin =
    intent.mode === "enrich_simple" || intent.mode === "enrich_photoreal";

  const nextGen = AlnabiyNextGenEngine.processExcellencePipeline({
    prompt: intent.enhancedPrompt,
    genreStyle: AlnabiyNextGenEngine.resolveGenreStyle(
      intent.mode === "preserve_style" ? "cartoon" : style
    ),
    targetFps: 60,
    enableSubsurfaceSkin: allowSkin,
  });

  return {
    ...core,
    enhancedPrompt: intent.enhancedPrompt,
    retentionHook: core.retentionHook,
    sentinel,
    nextGen: {
      ...nextGen,
      quantumMasterPrompt: intent.enhancedPrompt,
    },
    enhanceMode: intent.mode,
    detectedStyle: intent.detectedStyle,
    language: intent.language,
    engine: intent.engine,
  };
}

export async function enhancePrompt(
  prompt: string,
  style: VideoStyle = "cinematic",
  localeName = "English"
): Promise<string> {
  const detailed = await enhancePromptDetailed(prompt, style, localeName);
  return detailed.enhancedPrompt;
}

/** Script-to-Movie — OpenRouter scene breakdown (same single key) */
export async function analyzeScriptToScenes(
  script: string,
  targetDurationSec: number,
  style: VideoStyle
): Promise<ScriptAnalysisResult> {
  const sceneCount = Math.max(
    4,
    Math.min(12, Math.round(targetDurationSec / 8))
  );
  const perScene = Math.max(
    5,
    Math.round(targetDurationSec / sceneCount)
  );

  const fallback = (): ScriptAnalysisResult => ({
    title: "Al-Nabi Film",
    total_duration: targetDurationSec,
    style,
    scenes: Array.from({ length: sceneCount }, (_, i) => ({
      index: i + 1,
      visual_prompt: `${style} cinematic scene ${i + 1}: ${script.slice(0, 180)}`,
      voice_text: script.slice(0, 120),
      camera_movement: "static" as const,
      duration: perScene,
    })),
  });

  if (!createOpenRouterClient()) {
    return fallback();
  }

  const raw = await openRouterChat({
    model: getOpenRouterModel(),
    json: true,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: `Break a script into exactly ${sceneCount} video scenes for Al-Nabi Native Engine.
Preserve Uzbek (Latin/Cyrillic), Russian, or English orthography in voice_text to match the script language.
If the script implies Stickman, GTA Style, Anime, Voxel, etc., keep that art style in every visual_prompt — never force photoreal.
Return JSON only:
{"title":"string","total_duration":${targetDurationSec},"style":"${style}","scenes":[{"index":1,"visual_prompt":"...","voice_text":"...","camera_movement":"static|zoom_in|pan_left|orbit","duration":${perScene}}]}
No third-party AI brand names.`,
      },
      {
        role: "user",
        content: script.slice(0, 8000),
      },
    ],
  });

  if (!raw) return fallback();

  try {
    const parsed = JSON.parse(raw) as ScriptAnalysisResult;
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      return fallback();
    }
    return {
      title: parsed.title || "Al-Nabi Film",
      total_duration: parsed.total_duration || targetDurationSec,
      style: parsed.style || style,
      scenes: parsed.scenes.map((s, i) => ({
        index: s.index || i + 1,
        visual_prompt: s.visual_prompt || `${style} scene ${i + 1}`,
        voice_text: s.voice_text || "",
        camera_movement: s.camera_movement || "static",
        duration: s.duration || perScene,
      })),
    };
  } catch {
    return fallback();
  }
}
