import { NextRequest } from "next/server";
import path from "path";
import { z } from "zod";
import { synthesizeSpeech, isElevenLabsConfigured } from "@/lib/ai/elevenlabs";
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
import { chargeCredits, rollbackCredits } from "@/lib/credit-gate";
import {
  calculateTtsClipCost,
  estimateSpeechDurationSec,
} from "@/lib/credits";
import { scanHalol } from "@/lib/halol";
import { enforceGenerationTrust } from "@/lib/trust/generation-gate";

const schema = z.object({
  text: z.string().min(1).max(5000),
  emotion: z
    .enum(["neutral", "joy", "drama", "epic", "calm", "inspiring"])
    .default("neutral"),
  voiceId: z.string().optional(),
  locale: z.string().optional(),
  visualPrompt: z.string().optional(),
  withDirector: z.boolean().default(true),
  clientBalance: z.number().optional(),
});

/**
 * Al-Nabi Voice synthesis (server-side only) + optional Smart Director plan.
 * Real ElevenLabs clips charge NC; mock/dev audio is never billed.
 */
export async function POST(req: NextRequest) {
  try {
    const blocked = await guardSensitiveRequest(req);
    if (blocked) return blocked;

    const ensured = await ensureRequestLedgerUser({
      alnabiyKey: req.headers.get("x-alnabiy-key"),
      allowGuest: isSoftAuthEnabled(),
      request: req,
    });
    if (!ensured) {
      return apiError("Sign in required", {
        status: 401,
        code: "AUTH_REQUIRED",
      });
    }

    const body = schema.parse(await req.json());
    const trustFailure = await enforceGenerationTrust({
      userId: ensured.user.id,
      surface: "audio-synthesize",
      text: [body.text, body.visualPrompt].filter(Boolean).join("\n"),
    });
    if (trustFailure) {
      return apiError(trustFailure.message, {
        status:
          trustFailure.code === "SAFETY_UNAVAILABLE" ||
          trustFailure.code === "TRUST_UNAVAILABLE"
            ? 503
            : trustFailure.code === "CONSENT_REQUIRED"
              ? 428
              : trustFailure.code === "ENTITLEMENT_REQUIRED"
                ? 403
                : 422,
        code: trustFailure.code,
        extra: trustFailure.missingConsents
          ? { missingConsents: trustFailure.missingConsents }
          : undefined,
      });
    }
    if (scanHalol(body.text).blocked) {
      return apiError("Forbidden content", {
        status: 400,
        code: "FORBIDDEN",
      });
    }

    const locale = resolveLocale(
      body.locale,
      req.headers.get("x-alnabiy-locale"),
      req.cookies.get("alnabiy_locale")?.value
    );

    const billable = isElevenLabsConfigured();
    const cost = billable
      ? calculateTtsClipCost(estimateSpeechDurationSec(body.text))
      : 0;
    const charge =
      cost > 0
        ? await chargeCredits({
            kind: "image",
            durationSec: 1,
            fixedCost: cost,
            alnabiyKey: req.headers.get("x-alnabiy-key") || ensured.user.alnabiyKey,
            clientBalance: body.clientBalance ?? ensured.user.coins,
            reason: "charge:audio_tts",
            noBonus: true,
          })
        : null;

    if (charge && !charge.ok) {
      return apiJson(
        {
          ok: false,
          error: charge.message || "Insufficient NC",
          code: charge.code,
          cost: charge.cost,
          required: charge.required ?? charge.cost,
          balanceAfter: charge.balanceAfter,
        },
        { status: charge.code === "INSUFFICIENT" ? 402 : 400 }
      );
    }

    const storage = process.env.STORAGE_DIR || "./storage";
    const outPath = path.join(storage, "audio", `tts_${Date.now()}.mp3`);

    let audio;
    try {
      audio = await synthesizeSpeech({
        text: body.text,
        outPath,
        emotion: body.emotion,
        voiceId: body.voiceId,
      });
    } catch (e) {
      if (charge?.ok) {
        await rollbackCredits({
          amount: charge.cost,
          alnabiyKey: req.headers.get("x-alnabiy-key") || ensured.user.alnabiyKey,
          userId: charge.userId,
          receiptId: charge.receiptId,
          clientBalance: charge.balanceAfter,
          reason: "rollback:audio_tts",
        });
      }
      throw e;
    }

    if (audio.mock && charge?.ok) {
      await rollbackCredits({
        amount: charge.cost,
        alnabiyKey: req.headers.get("x-alnabiy-key") || ensured.user.alnabiyKey,
        userId: charge.userId,
        receiptId: charge.receiptId,
        clientBalance: charge.balanceAfter,
        reason: "rollback:audio_tts_mock",
      });
    }

    const billed = Boolean(charge?.ok && !audio.mock);
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
        creditsCost: billed ? charge?.cost ?? 0 : 0,
        balanceAfter: billed ? charge?.balanceAfter : ensured.user.coins,
        receiptId: billed ? charge?.receiptId : undefined,
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
