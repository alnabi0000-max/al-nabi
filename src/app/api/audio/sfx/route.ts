import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { apiError, apiJson } from "@/lib/api/json-response";
import { sanitizeGenerationError } from "@/lib/generation/public-error";
import { guardSensitiveRequest } from "@/lib/security/request-guard";
import {
  ensureRequestLedgerUser,
  isSoftAuthEnabled,
} from "@/lib/auth/ensure-request-user";
import { chargeCredits, rollbackCredits } from "@/lib/credit-gate";
import { AUDIO_CREDIT_RATES } from "@/lib/credits";
import { scanHalol } from "@/lib/halol";
import { isElevenLabsConfigured } from "@/lib/ai/elevenlabs";
import { synthesizeFoleyClip } from "@/lib/producer/foley";
import { ALNABIY_ENGINES, sanitizePublicPayload } from "@/lib/models";

const schema = z.object({
  prompt: z.string().min(2).max(400),
  durationSec: z.number().min(0.4).max(8).optional().default(1.6),
  startSec: z.number().min(0).max(30).optional().default(0),
  clientBalance: z.number().optional(),
});

/**
 * Studio SFX / Foley clip via Al-Nabi Audio Engine (ElevenLabs sound-generation).
 * Procedural mock fallback is never billed.
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
    if (scanHalol(body.prompt).blocked) {
      return apiError("Forbidden content", {
        status: 400,
        code: "FORBIDDEN",
      });
    }

    const billable = isElevenLabsConfigured();
    const cost = billable ? AUDIO_CREDIT_RATES.sfxPerClip : 0;
    const charge =
      cost > 0
        ? await chargeCredits({
            kind: "image",
            durationSec: 1,
            fixedCost: cost,
            alnabiyKey:
              req.headers.get("x-alnabiy-key") || ensured.user.alnabiyKey,
            clientBalance: body.clientBalance ?? ensured.user.coins,
            reason: "charge:audio_sfx",
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
    const outDir = path.join(storage, "audio");
    const id = `sfx_${Date.now().toString(36)}`;
    let clip;
    try {
      clip = await synthesizeFoleyClip({
        cue: {
          id,
          label: body.prompt.slice(0, 48),
          description: body.prompt,
          startMs: Math.round(body.startSec * 1000),
          durationMs: Math.round(body.durationSec * 1000),
        },
        outDir,
      });
    } catch (e) {
      if (charge?.ok) {
        await rollbackCredits({
          amount: charge.cost,
          alnabiyKey:
            req.headers.get("x-alnabiy-key") || ensured.user.alnabiyKey,
          userId: charge.userId,
          receiptId: charge.receiptId,
          clientBalance: charge.balanceAfter,
          reason: "rollback:audio_sfx",
        });
      }
      throw e;
    }

    if (clip.mock && charge?.ok) {
      await rollbackCredits({
        amount: charge.cost,
        alnabiyKey: req.headers.get("x-alnabiy-key") || ensured.user.alnabiyKey,
        userId: charge.userId,
        receiptId: charge.receiptId,
        clientBalance: charge.balanceAfter,
        reason: "rollback:audio_sfx_mock",
      });
    }

    const billed = Boolean(charge?.ok && !clip.mock);
    const fileName = path.basename(clip.audioPath);
    let audioBase64: string | undefined;
    try {
      const buf = await fs.readFile(clip.audioPath);
      if (buf.length > 40) audioBase64 = buf.toString("base64");
    } catch {
      /* file URL still works */
    }

    return apiJson(
      sanitizePublicPayload({
        ok: true,
        success: true,
        creditsCost: billed ? charge?.cost ?? 0 : 0,
        balanceAfter: billed ? charge?.balanceAfter : ensured.user.coins,
        receiptId: billed ? charge?.receiptId : undefined,
        audio: {
          url: `/api/media/audio/${fileName}`,
          durationMs: clip.durationMs,
          startMs: clip.startMs,
          mock: clip.mock,
          label: clip.label,
          audioBase64,
        },
        engine: ALNABIY_ENGINES.voice,
        watermark: "Al-Nabi Preview",
      })
    );
  } catch (e) {
    return apiError(sanitizeGenerationError(e, "SFX synthesis failed"), {
      status: 400,
      code: "SFX_FAILED",
    });
  }
}
