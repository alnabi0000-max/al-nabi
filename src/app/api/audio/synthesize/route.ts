import { NextRequest } from "next/server";
import path from "path";
import { z } from "zod";
import { synthesizeSpeech } from "@/lib/ai/elevenlabs";
import { syncWordsToFrames } from "@/lib/director";
import { resolveLocale } from "@/lib/i18n/messages";
import { ALNABIY_ENGINES, sanitizePublicPayload } from "@/lib/models";
import { apiError, apiJson } from "@/lib/api/json-response";
import { sanitizeGenerationError } from "@/lib/generation/public-error";
import { guardSensitiveRequest } from "@/lib/security/request-guard";
import {
  ensureRequestLedgerUser,
  isSoftAuthEnabled,
} from "@/lib/auth/ensure-request-user";

const schema = z.object({
  text: z.string().min(1).max(5000),
  emotion: z
    .enum(["neutral", "joy", "drama", "epic", "calm", "inspiring"])
    .default("neutral"),
  voiceId: z.string().optional(),
  locale: z.string().optional(),
  visualPrompt: z.string().optional(),
  withDirector: z.boolean().default(true),
});

/**
 * Al-Nabi Voice synthesis (server-side only) + optional Smart Director plan.
 */
export async function POST(req: NextRequest) {
  try {
    const blocked = await guardSensitiveRequest(req);
    if (blocked) return blocked;

    const ensured = await ensureRequestLedgerUser({
      alnabiyKey: req.headers.get("x-alnabiy-key"),
      allowGuest: isSoftAuthEnabled(),
    });
    if (!ensured) {
      return apiError("Sign in required", {
        status: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const body = schema.parse(await req.json());
    const locale = resolveLocale(
      body.locale,
      req.headers.get("x-alnabiy-locale"),
      req.cookies.get("alnabiy_locale")?.value
    );

    const storage = process.env.STORAGE_DIR || "./storage";
    const outPath = path.join(
      storage,
      "audio",
      `tts_${Date.now()}.mp3`
    );

    const audio = await synthesizeSpeech({
      text: body.text,
      outPath,
      emotion: body.emotion,
      voiceId: body.voiceId,
    });

    const director = body.withDirector
      ? syncWordsToFrames({
          words: audio.words,
          visualPrompt: body.visualPrompt || body.text,
          fps: 24,
          engine: "hybrid",
          fallbackDurationMs: audio.durationMs,
        })
      : null;

    return apiJson(
      sanitizePublicPayload({
        ok: true,
        success: true,
        locale,
        audio: {
          url: `/api/media/audio/${path.basename(audio.audioPath)}`,
          durationMs: audio.durationMs,
          words: audio.words,
          model: ALNABIY_ENGINES.voice,
          mock: audio.mock,
          preparedText: audio.preparedText,
          audioBase64: audio.mock ? undefined : audio.audioBase64,
        },
        director,
        watermark: "Al-Nabi Preview",
      })
    );
  } catch (e) {
    return apiError(sanitizeGenerationError(e, "Voice synthesis failed"), {
      status: 400,
      code: "AUDIO_FAILED",
    });
  }
}
