import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chargeCredits, computeCost } from "@/lib/credit-gate";
import { guardSensitiveRequest } from "@/lib/security/request-guard";

const ENGINE_IDS = [
  "kling-v2.5",
  "kling-v3",
  "luma-ray2",
  "runway-gen3",
  "wan-2.5",
  "minimax",
  "flux-pro",
  "sd3.5-large",
  "auto",
] as const;

const schema = z.object({
  kind: z.enum(["image", "prompt_to_video", "text_to_movie"]),
  durationSec: z.number().min(1).max(600).optional(),
  alnabiyKey: z.string().optional().nullable(),
  clientBalance: z.number().optional(),
  reason: z.string().optional(),
  jobId: z.string().optional(),
  /** Faqat narx so'rov — hech narsa yechilmaydi */
  quoteOnly: z.boolean().optional(),
  /** Model / quality — quote va charge bir xil formulada */
  engine: z.enum(ENGINE_IDS).optional(),
  quality: z.enum(["720p", "1080p", "4K", "8K"]).optional(),
  frameRate: z.union([z.literal(24), z.literal(30), z.literal(60)]).optional(),
});

/**
 * Credit Calculator Middleware endpoint
 * quoteOnly=true → shared formula estimate
 * quoteOnly=false → debit (server recomputes cost; never trusts a client "cost" field)
 */
export async function POST(req: NextRequest) {
  try {
    const blocked = await guardSensitiveRequest(req);
    if (blocked) return blocked;

    const body = schema.parse(await req.json());
    const durationSec = body.durationSec ?? 60;
    const costOpts = {
      engine: body.engine,
      quality: body.quality,
      frameRate: body.frameRate,
    };
    const cost = computeCost(body.kind, durationSec, costOpts);

    if (body.quoteOnly) {
      return NextResponse.json({
        ok: true,
        cost,
        kind: body.kind,
        durationSec,
        costOpts,
      });
    }

    const result = await chargeCredits({
      kind: body.kind,
      durationSec,
      alnabiyKey: body.alnabiyKey,
      clientBalance: body.clientBalance,
      reason: body.reason || `ui:${body.kind}`,
      jobId: body.jobId,
      costOpts,
      noBonus: true,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ...result,
          required: result.required ?? result.cost,
        },
        {
          status:
            result.code === "BANNED"
              ? 403
              : result.code === "UNAVAILABLE"
                ? 503
                : 402,
        }
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Charge failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
