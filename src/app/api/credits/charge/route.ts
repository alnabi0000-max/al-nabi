import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chargeCredits, computeCost } from "@/lib/credit-gate";
import { guardSensitiveRequest } from "@/lib/security/request-guard";

const schema = z.object({
  kind: z.enum(["image", "prompt_to_video", "text_to_movie"]),
  durationSec: z.number().min(1).max(600).optional(),
  alnabiyKey: z.string().optional().nullable(),
  clientBalance: z.number().optional(),
  reason: z.string().optional(),
  jobId: z.string().optional(),
  /** Faqat narx so'rov */
  quoteOnly: z.boolean().optional(),
});

/**
 * Credit Calculator Middleware endpoint
 * Create / Download oldidan chaqiriladi
 */
export async function POST(req: NextRequest) {
  try {
    const blocked = await guardSensitiveRequest(req);
    if (blocked) return blocked;

    const body = schema.parse(await req.json());
    const durationSec = body.durationSec ?? 60;
    const cost = computeCost(body.kind, durationSec);

    if (body.quoteOnly) {
      return NextResponse.json({ ok: true, cost, kind: body.kind, durationSec });
    }

    const result = await chargeCredits({
      kind: body.kind,
      durationSec,
      alnabiyKey: body.alnabiyKey,
      clientBalance: body.clientBalance,
      reason: body.reason || `ui:${body.kind}`,
      jobId: body.jobId,
    });

    if (!result.ok) {
      return NextResponse.json(result, {
        status: result.code === "BANNED" ? 403 : 402,
      });
    }

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Charge failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
