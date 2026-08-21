import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import path from "path";
import { analyzeScriptToScenes } from "@/lib/llm";
import {
  generateVideoClip,
  CLIP_DURATION_SEC,
} from "@/lib/video-provider";
import { synthesizeSpeech } from "@/lib/ai/elevenlabs";
import {
  buildMovieDirectorPlan,
  planToKeyframePrompts,
} from "@/lib/director";
import {
  muxVideoWithAudio,
  runMoviePipeline,
  assertFfmpegAvailable,
  FfmpegCapabilityError,
} from "@/lib/ffmpeg-worker";
import { mixVoiceAndFoley } from "@/lib/producer/compose";
import { resolveBgmSelection } from "@/lib/bgm";
import { chargeCredits, computeCost, rollbackCredits } from "@/lib/credit-gate";
import { persistJobAsset } from "@/lib/assets";
import { ALNABIY_ENGINES, sanitizePublicPayload } from "@/lib/models";
import { AlnabiySentinelEngine } from "@/lib/sentinel-engine";
import { WATERMARK, formatInsufficientFundsMessage } from "@/lib/credits";
import type { VideoStyle } from "@/lib/types";
import type { WordTiming } from "@/lib/audio";
import { guardSensitiveRequest } from "@/lib/security/request-guard";
import {
  assertPersistentObjectStorage,
  ObjectStorageConfigurationError,
  persistRemoteAsset,
} from "@/lib/storage/object-storage";
import { createSignedGetUrl } from "@/lib/storage/signed-url";
import { enforceGenerationTrust } from "@/lib/trust/generation-gate";

const schema = z.object({
  script: z.string().min(40).max(50000),
  durationSec: z.number().min(30).max(600).default(60),
  style: z
    .enum(["cinematic", "cartoon", "anime", "realistic"])
    .default("cinematic"),
  emotionMode: z
    .enum(["neutral", "joy", "drama", "epic", "calm", "inspiring"])
    .default("drama"),
  locale: z.string().optional(),
  voiceId: z.string().optional(),
  alnabiyKey: z.string().optional().nullable(),
  clientBalance: z.number().optional(),
  engine: z
    .enum([
      "kling-v2.5",
      "kling-v3",
      "luma-ray2",
      "runway-gen3",
      "wan-2.5",
      "minimax",
      "auto",
    ])
    .optional(),
  quality: z.enum(["720p", "1080p", "4K", "8K"]).default("1080p"),
  frameRate: z.union([z.literal(24), z.literal(30), z.literal(60)]).default(24),
  cameraMove: z
    .enum([
      "static",
      "zoom_in",
      "zoom_out",
      "pan_left",
      "pan_right",
      "tilt_up",
      "tilt_down",
      "slow_mo",
      "orbit",
    ])
    .optional(),
  bgmMode: z.enum(["ai", "manual", "off"]).optional().default("ai"),
  bgmTrackId: z.string().max(200).optional().nullable(),
});

/**
 * Script-to-Movie:
 * Analyze (free of NC debit) → charge once before first paid speech/video
 * provider call → scenes → mux. Failure after debit → rollback.
 */
export async function POST(req: NextRequest) {
  const jobId = `job_${Date.now()}`;
  let charge: Awaited<ReturnType<typeof chargeCredits>> | null = null;
  let ledgerKey: string | null | undefined;

  try {
    const blocked = await guardSensitiveRequest(req);
    if (blocked) return blocked;

    const body = schema.parse(await req.json());
    const { ensureRequestLedgerUser, isSoftAuthEnabled } = await import(
      "@/lib/auth/ensure-request-user"
    );
    const ensured = await ensureRequestLedgerUser({
      alnabiyKey: body.alnabiyKey,
      allowGuest: isSoftAuthEnabled(),
      request: req,
    });
    if (!ensured) {
      return NextResponse.json(
        { ok: false, code: "AUTH_REQUIRED", error: "Sign in required" },
        { status: 401 }
      );
    }
    const trustFailure = await enforceGenerationTrust({
      userId: ensured.user.id,
      surface: "script-pipeline",
      text: body.script,
    });
    if (trustFailure) {
      return NextResponse.json(
        {
          ok: false,
          code: trustFailure.code,
          error: trustFailure.message,
          missingConsents: trustFailure.missingConsents,
        },
        {
          status:
            trustFailure.code === "SAFETY_UNAVAILABLE" ||
            trustFailure.code === "TRUST_UNAVAILABLE"
              ? 503
              : trustFailure.code === "CONSENT_REQUIRED"
                ? 428
                : trustFailure.code === "ENTITLEMENT_REQUIRED"
                  ? 403
                  : 422,
        }
      );
    }
    await assertFfmpegAvailable();
    assertPersistentObjectStorage();

    /* Trust enforcement has already made the deterministic safety decision. */
    const gate = AlnabiySentinelEngine.processInput(body.script);
    ledgerKey = ensured.user.alnabiyKey || body.alnabiyKey;

    const costOpts = {
      engine: body.engine || "auto",
      quality: body.quality,
      frameRate: body.frameRate,
    };
    const expectedCost = computeCost(
      "text_to_movie",
      body.durationSec,
      costOpts
    );

    if (ensured.user.coins < expectedCost) {
      return NextResponse.json(
        {
          ok: false,
          jobId,
          status: "FAILED",
          code: "INSUFFICIENT",
          cost: expectedCost,
          required: expectedCost,
          balanceAfter: ensured.user.coins,
          error: formatInsufficientFundsMessage(
            expectedCost,
            ensured.user.coins
          ),
        },
        { status: 402 }
      );
    }

    const analysis = await analyzeScriptToScenes(
      gate.renderPrompt,
      body.durationSec,
      body.style as VideoStyle
    );

    const storage = process.env.STORAGE_DIR || "./storage";
    const bgm = await resolveBgmSelection({
      mode: body.bgmMode || "ai",
      trackId: body.bgmTrackId,
      prompt: body.script,
      emotion: body.emotionMode,
      seed: jobId,
    });
    const enriched: Array<{
      index: number;
      visual_prompt: string;
      voice_text: string;
      camera_movement: string;
      duration: number;
      videoUrl?: string;
      audioPath?: string;
      muxedPath?: string;
      words?: WordTiming[];
      durationMs?: number;
    }> = [];

    for (const scene of analysis.scenes) {
      if (!charge) {
        charge = await chargeCredits({
          kind: "text_to_movie",
          durationSec: body.durationSec,
          alnabiyKey: ledgerKey,
          clientBalance: body.clientBalance,
          jobId,
          reason: `pipeline:text_to_movie:${body.engine || "auto"}:provider`,
          costOpts,
          noBonus: true,
        });
        if (!charge.ok) {
          return NextResponse.json(
            {
              ok: false,
              jobId,
              status: "FAILED",
              error: charge.message,
              code: charge.code,
              cost: charge.cost,
              required: charge.required ?? charge.cost,
              balanceAfter: charge.balanceAfter,
            },
            {
              status:
                charge.code === "INSUFFICIENT"
                  ? 402
                  : charge.code === "BANNED"
                    ? 403
                    : charge.code === "UNAVAILABLE"
                      ? 503
                      : 500,
            }
          );
        }
      }

      const sceneDuration = CLIP_DURATION_SEC;
      const audioPath = path.join(
        storage,
        "jobs",
        jobId,
        `a_${scene.index}.mp3`
      );

      const speech = await synthesizeSpeech({
        text: scene.voice_text,
        outPath: audioPath,
        emotion: body.emotionMode,
        voiceId: body.voiceId,
      });

      const video = await generateVideoClip({
        prompt: scene.visual_prompt,
        cameraMove:
          body.cameraMove ||
          (scene.camera_movement as
            | "static"
            | "zoom_in"
            | "zoom_out"
            | "pan_left"
            | "pan_right"
            | "tilt_up"
            | "tilt_down"
            | "slow_mo"
            | "orbit"
            | undefined),
        engine: body.engine || "auto",
        durationSec: sceneDuration,
        quality: body.quality || "1080p",
        frameRate: body.frameRate,
      });

      if (!video.url) {
        throw new Error(`Scene ${scene.index} video empty`);
      }

      const muxedPath = path.join(
        storage,
        "jobs",
        jobId,
        `mux_${scene.index}.mp4`
      );

      if (!speech.mock) {
        let audioForMux = speech.audioPath;
        if (bgm) {
          const mixedPath = path.join(
            storage,
            "jobs",
            jobId,
            `mix_${scene.index}.m4a`
          );
          await mixVoiceAndFoley({
            voicePath: speech.audioPath,
            foley: [],
            outputPath: mixedPath,
            durationSec: sceneDuration,
            bgmPath: bgm.path,
          });
          audioForMux = mixedPath;
        }
        await muxVideoWithAudio({
          videoPathOrUrl: video.url,
          audioPath: audioForMux,
          outputPath: muxedPath,
          durationSec: sceneDuration,
        });
      }

      enriched.push({
        index: scene.index,
        visual_prompt: scene.visual_prompt,
        voice_text: scene.voice_text,
        camera_movement: scene.camera_movement,
        duration: sceneDuration,
        videoUrl: video.url,
        audioPath,
        muxedPath: speech.mock ? undefined : muxedPath,
        words: speech.words,
        durationMs: speech.durationMs,
      });
    }

    const director = buildMovieDirectorPlan({
      scenes: enriched.map((s) => ({
        visual_prompt: s.visual_prompt,
        voice_text: s.voice_text,
        camera_movement: s.camera_movement,
        words: s.words,
        durationMs: s.durationMs || CLIP_DURATION_SEC * 1000,
      })),
      fps: 24,
      engine: "hybrid",
    });
    const keyframes = planToKeyframePrompts(director, 500);

    const muxedClips = enriched.filter((s) => s.muxedPath);
    let resultPath: string;

    if (muxedClips.length > 0) {
      const { mergeClipsToMp4 } = await import("@/lib/ffmpeg-worker");
      resultPath = path.join(storage, "jobs", jobId, "final.mp4");
      await mergeClipsToMp4(
        muxedClips.map((s) => ({
          videoPath: s.muxedPath!,
          duration: CLIP_DURATION_SEC,
        })),
        resultPath
      );
    } else {
      resultPath = await runMoviePipeline({
        jobId,
        scenes: enriched.map((s) => ({
          index: s.index,
          visual_prompt: s.visual_prompt,
          voice_text: s.voice_text,
          camera_movement: s.camera_movement,
          duration: s.duration,
          videoUrl: s.videoUrl,
          audioPath: s.audioPath,
        })),
      });
    }

    const stored = await persistRemoteAsset({
      sourceUrl: resultPath,
      userId: ensured.user.id,
      generationId: jobId,
      kind: "video",
    });
    const sceneCount = enriched.length;
    const resultUrl = stored.url || (await createSignedGetUrl(stored.key));
    if (!resultUrl) {
      throw new Error("Private media could not be signed for delivery");
    }

    await persistJobAsset({
      jobId,
      // In Supabase mode, the browser never receives the legacy bearer key.
      // Carry the server-resolved owner identity through this legacy helper.
      alnabiyKey: ledgerKey,
      kind: "text_to_movie",
      prompt: analysis.title,
      script: body.script,
      enhancedPrompt: analysis.title,
      resultUrl: stored.url,
      durationSec: body.durationSec,
      emotionMode: body.emotionMode,
      style: body.style,
      quality: "4K",
      provider: "script-pipeline",
      creditsCost: charge?.cost || expectedCost,
      r2Key: stored.key,
    });

    return NextResponse.json(
      sanitizePublicPayload({
        ok: true,
        jobId,
        status: "COMPLETED",
        sceneCount,
        creditsCost: charge?.cost || expectedCost,
        balanceAfter: charge?.balanceAfter,
        receiptId: charge?.receiptId,
        resultUrl,
        clipDurationSec: CLIP_DURATION_SEC,
        analysis: {
          title: analysis.title,
          total_duration: analysis.total_duration,
          scenes: analysis.scenes.map((s) => ({
            index: s.index,
            duration: CLIP_DURATION_SEC,
            camera_movement: s.camera_movement,
          })),
        },
        director: {
          fps: director.fps,
          totalDurationMs: director.totalDurationMs,
          totalFrames: director.totalFrames,
          engine: ALNABIY_ENGINES.cinema,
          keyframeCount: keyframes.length,
        },
        keyframes,
        watermark: WATERMARK,
        engines: {
          audio: ALNABIY_ENGINES.voice,
          video: ALNABIY_ENGINES.cinema,
          sync: ALNABIY_ENGINES.director,
        },
      })
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Pipeline failed";
    if (charge?.ok) {
      await rollbackCredits({
        amount: charge.cost,
        alnabiyKey: ledgerKey,
        userId: charge.userId,
        receiptId: charge.receiptId,
        jobId,
        clientBalance: charge.balanceAfter,
        reason: `rollback:${msg.slice(0, 80)}`,
      }).catch(() => undefined);
    }
    return NextResponse.json(
      {
        ok: false,
        jobId,
        status: "FAILED",
        error: msg,
        rolledBack: charge?.ok ? charge.cost : 0,
      },
      {
        status:
          e instanceof FfmpegCapabilityError ||
          e instanceof ObjectStorageConfigurationError
            ? 503
            : 500,
      }
    );
  }
}
