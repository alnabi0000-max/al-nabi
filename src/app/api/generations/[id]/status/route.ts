import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { GenerationType, GenerationStatus } from "@prisma/client";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { sanitizePublicPayload, whiteLabelEngine } from "@/lib/models";
import { sanitizeGenerationError } from "@/lib/generation/public-error";
import { reclaimStaleGeneration } from "@/lib/generation/fail-and-refund";

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

function toPayload(generation: GenerationRow) {
  const done = generation.status === "COMPLETED";
  const failed = generation.status === "FAILED";
  return sanitizePublicPayload({
    ok: true as const,
    generationId: generation.id,
    jobId: generation.id,
    type: generation.type,
    status: generation.status,
    done,
    failed,
    resultUrl: generation.resultUrl,
    r2Key: generation.r2Key,
    provider: whiteLabelEngine(generation.provider),
    creditsCost: generation.creditsCost,
    errorMessage: generation.errorMessage
      ? sanitizeGenerationError(generation.errorMessage)
      : null,
    durationSec: generation.durationSec,
    emotionMode: generation.emotionMode,
    quality: generation.quality,
    createdAt: generation.createdAt.toISOString(),
    updatedAt: generation.updatedAt.toISOString(),
    videoUrl:
      done && generation.type !== "IMAGE" ? generation.resultUrl : null,
    imageUrl:
      done && generation.type === "IMAGE" ? generation.resultUrl : null,
  });
}

async function authorize(
  id: string,
  req: NextRequest
): Promise<
  | { ok: true; generation: GenerationRow }
  | { ok: false; status: number; error: string }
> {
  const key =
    req.headers.get("x-alnabiy-key") ||
    req.nextUrl.searchParams.get("key") ||
    null;

  let userId: string | null = null;
  try {
    if (key) {
      const { resolveUserByKey } = await import("@/lib/assets");
      const byKey = await resolveUserByKey(key);
      userId = byKey?.id ?? null;
    }
    if (!userId) {
      const { getLocalSessionUser } = await import("@/lib/auth/session");
      const session = await getLocalSessionUser().catch(() => null);
      userId = session?.id ?? null;
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

  return { ok: true, generation };
}

/**
 * GET — JSON poll
 * GET ?stream=1 — Server-Sent Events
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
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

    if (!stream) {
      return apiJson({ success: true, ...toPayload(row) });
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

        send(toPayload(row));

        const started = Date.now();
        while (!closed && Date.now() - started < 120_000) {
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
            const payload = toPayload(again);
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
