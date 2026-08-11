import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiJson } from "@/lib/api/json-response";
import { analyzeVisualDna } from "@/lib/producer/vision-dna";
import { guardSensitiveRequest } from "@/lib/security/request-guard";
import {
  ensureRequestLedgerUser,
  isSoftAuthEnabled,
} from "@/lib/auth/ensure-request-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  imageUrl: z.string().min(16).max(8_000_000),
  locale: z.string().optional(),
  userLevel: z.enum(["beginner", "advanced"]).optional(),
});

/** Visual DNA — Al-Nabi Native Engine */
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
    const dna = await analyzeVisualDna({
      imageUrl: body.imageUrl,
      locale: body.locale,
      userLevel: body.userLevel,
    });

    return apiJson({
      success: true,
      ok: true,
      engine: "Al-Nabi Native Engine",
      visualDna: dna,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Vision failed", {
      status: 400,
      code: "VISION_FAILED",
    });
  }
}
