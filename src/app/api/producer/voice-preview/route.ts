import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { apiError, apiJson } from "@/lib/api/json-response";
import { synthesizeSpeech } from "@/lib/audio";
import { ALNABIY_ENGINES } from "@/lib/models";
import { guardSensitiveRequest } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  text: z.string().min(2).max(400),
  narration: z
    .enum(["neutral", "joy", "drama", "epic", "calm", "inspiring"])
    .default("epic"),
});

/**
 * 3-second zero-cost voice preview — Al-Nabi Audio Engine (no NC charge).
 */
export async function POST(req: NextRequest) {
  try {
    const blocked = await guardSensitiveRequest(req);
    if (blocked) return blocked;

    const body = schema.parse(await req.json());
    // Keep preview short (~3s spoken) to avoid accidental full-length billing elsewhere
    const previewText = body.text.trim().slice(0, 120);
    const storage = process.env.STORAGE_DIR || "./storage";
    const jobId = `vp_${Date.now().toString(36)}`;
    const outPath = path.join(storage, "producer", "previews", `${jobId}.mp3`);

    const speech = await synthesizeSpeech({
      text: previewText,
      outPath,
      emotion: body.narration,
    });

    let audioUrl = `/api/media/producer/previews/${jobId}.mp3`;
    try {
      const buf = await fs.readFile(outPath);
      if (buf.length > 0) {
        audioUrl = `data:audio/mpeg;base64,${buf.toString("base64")}`;
      }
    } catch {
      /* keep file URL */
    }

    return apiJson({
      success: true,
      ok: true,
      free: true,
      feeNc: 0,
      currency: "NC",
      durationHintSec: 3,
      audioUrl,
      fileUrl: `/api/media/producer/previews/${jobId}.mp3`,
      audioPath: speech.audioPath,
      engine: ALNABIY_ENGINES.voice,
      mock: speech.mock,
      message: "3s voice preview · 0 NC",
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Preview failed", {
      status: 400,
      code: "PREVIEW_FAILED",
    });
  }
}
