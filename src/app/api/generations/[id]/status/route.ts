import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { GenerationType, GenerationStatus } from "@prisma/client";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { sanitizePublicPayload, whiteLabelEngine } from "@/lib/models";
import { sanitizeGenerationError } from "@/lib/generation/public-error";
import { reclaimStaleGeneration } from "@/lib/generation/fail-and-refund";
import { ensureRequestLedgerUser } from "@/lib/auth/ensure-request-user";
import { resolvePrivateDeliveryUrl } from "@/lib/storage/signed-url";
import { progressFromStatus } from "@/lib/generation/progress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type Ctx = { params: Promise<{ id: string }> };

type GenerationRow = {
  id: string;
  userId: string;
  type: GenerationType;
  status: GenerationStatus;
  prompt: string | null;
  resultUrl: string | null;
  r2Key: string | null;
  provider: string | null;
  creditsCost: number;
  errorMessage: string | null;
  durationSec: number;
  emotionMode: string | null;
  quality: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const generationSelect = {
  id: true,
  userId: true,
  type: true,
  status: true,
  prompt: true,
  resultUrl: true,
  r2Key: true,
  provider: true,
  creditsCost: true,
  errorMessage: true,
  durationSec: true,
  emotionMode: true,
  quality: true,
  createdAt: true,
  updatedAt: true,
} as const;

function hasCredentialInQuery(req: NextRequest): boolean {
  return ["key", "alnabiyKey", "alnabiy_key"].some((name) =>
    req.nextUrl.searchParams.has(name)
  );
}

async function toPayload(
  generation: GenerationRow,
  balanceAfter?: number
) {
  const done = generation.status === "COMPLETED";
  const failed = generation.status === "FAILED";
  const prog = progressFromStatus(generation.status);
  const deliveryUrl = done
    ? await resolvePrivateDeliveryUrl({
        objectKey: generation.r2Key,
        resultUrl: generation.resultUrl,
      })
    : null;
  return sanitizePublicPayload({
    ok: true as const,
    generationId: generation.id,
    jobId: generation.id,
    type: generation.type,
    status: generation.status,
    done,
    failed,
    resultUrl: deliveryUrl,
    r2Key: generation.r2Key,
    provider: whiteLabelEngine(generation.provider),
    creditsCost: generation.creditsCost,
    balanceAfter,
    errorMessage: generation.errorMessage
      ? sanitizeGenerationError(generation.errorMessage)
      : null,
    durationSec: generation.durationSec,
    emotionMode: generation.emotionMode,
    quality: generation.quality,
    createdAt: generation.createdAt.toISOString(),
    updatedAt: generation.updatedAt.toISOString(),
    videoUrl:
      done && generation.type !== "IMAGE" ? deliveryUrl : null,
    imageUrl:
      done && generation.type === "IMAGE" ? deliveryUrl : null,
    percent: prog.percent,
    stage: prog.stage,
  });
}

async function authorize(
  id: string,
  req: NextRequest
): Promise<
  | { ok: true; generation: GenerationRow; balanceAfter?: number }
  | { ok: false; status: number; error: string }
> {
  let userId: string | null = null;
  let balanceAfter: number | undefined;
  try {
    const authenticated = await ensureRequestLedgerUser({
      alnabiyKey: req.headers.get("x-alnabiy-key"),
      allowGuest: false,
      request: req,
    });
    userId = authenticated?.user.id ?? null;
    balanceAfter = authenticated?.user.coins;
    if (userId && balanceAfter === undefined) {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { coins: true },
      });
      if (u) balanceAfter = u.coins;
    }
  } catch {
    /* soft — status poll hali ham ochiq bo‘lishi mumkin */
  }

  const generation = await prisma.generation.findUnique({
    where: { id },
    select: generationSelect,
  });

  if (!generation) {
    return { ok: false, status: 404, error: "Generation not found" };
  }
  if (!userId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  if (generation.userId !== userId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, generation, balanceAfter };
}

/**
 * GET — JSON poll
 * GET ?stream=1 — Server-Sent Events
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (hasCredentialInQuery(req)) {
      return apiError(
        "Credentials in URL query parameters are not accepted. Use an authenticated session.",
        { status: 400, code: "CREDENTIAL_IN_URL" }
      );
    }
    const stream = req.nextUrl.searchParams.get("stream") === "1";

    const loaded = await authorize(id, req);
    if (!loaded.ok) {
      return apiError(loaded.error, {
        status: loaded.status,
        code:
          loaded.status === 404
            ? "NOT_FOUND"
            : loaded.status === 401
              ? "UNAUTHORIZED"
              : "FORBIDDEN",
      });
    }

    /* Stuck jobs → FAILED + automatic credit refund */
    await reclaimStaleGeneration(id).catch(() => false);
    const fresh = await prisma.generation.findUnique({
      where: { id },
      select: generationSelect,
    });
    const row = fresh || loaded.generation;
    let balanceAfter = loaded.balanceAfter;
    if (balanceAfter === undefined) {
      const u = await prisma.user.findUnique({
        where: { id: row.userId },
        select: { coins: true },
      });
      balanceAfter = u?.coins;
    }

    if (!stream) {
      return apiJson({ success: true, ...(await toPayload(row, balanceAfter)) });
    }

    const encoder = new TextEncoder();
    let closed = false;

    const readable = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          if (closed) return;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        send(await toPayload(row, balanceAfter));

        const started = Date.now();
        while (!closed && Date.now() - started < 300_000) {
          await new Promise((r) => setTimeout(r, 2000));
          if (closed) break;
          try {
            await reclaimStaleGeneration(id).catch(() => false);
            const again = await prisma.generation.findUnique({
              where: { id },
              select: generationSelect,
            });
            if (!again) {
              send({ ok: false, error: "NOT_FOUND" });
              break;
            }
            const u = await prisma.user.findUnique({
              where: { id: again.userId },
              select: { coins: true },
            });
            const payload = await toPayload(again, u?.coins);
            send(payload);
            if (payload.done || payload.failed) break;
          } catch (e) {
            send({
              ok: false,
              error: "poll error",
            });
            break;
          }
        }

        closed = true;
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      },
      cancel() {
        closed = true;
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    const formatted = formatRouteError(e);
    console.error("[Alnabiy] /api/generations/status error:", formatted.message, e);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
