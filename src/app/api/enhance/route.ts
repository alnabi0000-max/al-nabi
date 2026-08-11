import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enhancePromptDetailed, SentinelBlockedError } from "@/lib/llm";
import type { VideoStyle } from "@/lib/types";
import { t, resolveLocale } from "@/lib/i18n/messages";
import { ALNABIY_ENGINES } from "@/lib/models";
import { guardSensitiveRequest } from "@/lib/security/request-guard";
import { moderateText } from "@/lib/security/moderation";
import {
  ensureRequestLedgerUser,
  isSoftAuthEnabled,
} from "@/lib/auth/ensure-request-user";

const schema = z.object({
  prompt: z.string().min(3).max(2000),
  style: z
    .enum(["cinematic", "cartoon", "anime", "realistic"])
    .default("cinematic"),
  locale: z.string().optional(),
  targetEra: z.string().optional(),
  alnabiyKey: z.string().optional().nullable(),
});

/**
 * Sentinel → Core Matrix Auto-Enhance
 */
export async function POST(req: NextRequest) {
  try {
    const blocked = await guardSensitiveRequest(req);
    if (blocked) return blocked;

    const body = schema.parse(await req.json());

    const ensured = await ensureRequestLedgerUser({
      alnabiyKey: body.alnabiyKey,
      allowGuest: isSoftAuthEnabled(),
    });
    if (!ensured) {
      return NextResponse.json(
        { ok: false, code: "AUTH_REQUIRED", error: "Sign in required" },
        { status: 401 }
      );
    }
    const mod = await moderateText(body.prompt);
    if (!mod.allowed) {
      return NextResponse.json(
        {
          ok: false,
          code: "MODERATION_BLOCKED",
          error: mod.reason || "Content rejected by moderation",
        },
        { status: 422 }
      );
    }
    const locale = resolveLocale(
      body.locale,
      req.headers.get("x-alnabiy-locale"),
      req.cookies.get("alnabiy_locale")?.value
    );
    const localeName = t(locale, "ai_locale_name");
    const matrix = await enhancePromptDetailed(
      body.prompt,
      body.style as VideoStyle,
      localeName
    );

    return NextResponse.json({
      enhanced: matrix.enhancedPrompt,
      enhanceMode: matrix.enhanceMode || null,
      detectedStyle: matrix.detectedStyle ?? null,
      language: matrix.language ?? null,
      locale,
      engine: matrix.engine || ALNABIY_ENGINES.cinema,
      brandTag: matrix.sentinel.brandTag,
      normalizedPrompts: matrix.sentinel.normalizedPrompts,
      sanitizedMetadata: matrix.sentinel.sanitizedMetadata,
      matrix: {
        cameraConfig: matrix.cameraConfig,
        lightingAndPhysics: matrix.lightingAndPhysics,
        audioLayers: matrix.audioLayers,
        retentionHook: matrix.retentionHook,
        eraKey: matrix.eraKey,
      },
      nextGen: {
        opticalParameters: matrix.nextGen.opticalParameters,
        audioMastering: matrix.nextGen.audioMastering,
        neuralRetentionScore: matrix.nextGen.neuralRetentionScore,
        frameMastering: matrix.nextGen.frameMastering,
        engine: matrix.nextGen.engine,
      },
    });
  } catch (e) {
    if (e instanceof SentinelBlockedError) {
      return NextResponse.json(
        {
          ok: false,
          code: "SENTINEL_BLOCKED",
          error: e.message,
          brandTag: "ALNABIY_BLOCKED",
        },
        { status: 422 }
      );
    }
    const msg = e instanceof Error ? e.message : "Enhance failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
