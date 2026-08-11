import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeScriptToScenes } from "@/lib/llm";
import { calculateMovieCredits } from "@/lib/credits";
import type { VideoStyle } from "@/lib/types";
import { guardSensitiveRequest } from "@/lib/security/request-guard";
import {
  ensureRequestLedgerUser,
  isSoftAuthEnabled,
} from "@/lib/auth/ensure-request-user";

const schema = z.object({
  script: z.string().min(40).max(50000),
  durationSec: z.number().min(30).max(600).default(60),
  style: z
    .enum(["cinematic", "cartoon", "anime", "realistic"])
    .default("cinematic"),
  alnabiyKey: z.string().optional().nullable(),
});

/**
 * Script Analysis Middleware — LLM Pipeline
 * Uzun matn → 5–8s sahnalar (visual_prompt, voice_text, camera_movement, duration)
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
    const analysis = await analyzeScriptToScenes(
      body.script,
      body.durationSec,
      body.style as VideoStyle
    );

    const creditsCost = calculateMovieCredits(
      analysis.total_duration || body.durationSec
    );

    return NextResponse.json({
      ok: true,
      analysis,
      sceneCount: analysis.scenes.length,
      creditsCost,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analyze failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
