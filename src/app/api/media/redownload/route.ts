import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiJson } from "@/lib/api/json-response";
import { ARCHIVE_REDOWNLOAD_FEE_NC } from "@/lib/credits";
import { ensureRequestLedgerUser } from "@/lib/auth/ensure-request-user";
import { createSignedGetUrl } from "@/lib/storage/signed-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  generationId: z.string().min(3),
  /** true = Cloud Vault path (first free, then 5 NC) */
  archive: z.boolean().default(true),
});

/**
 * Cloud Vault re-download.
 * First unlock free; later archive pulls charge ARCHIVE_REDOWNLOAD_FEE_NC (5 NC).
 */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const ensured = await ensureRequestLedgerUser({
      alnabiyKey: req.headers.get("x-alnabiy-key"),
    });
    if (!ensured) {
      return apiError("Sign in required for Cloud Vault", {
        status: 401,
        code: "UNAUTHORIZED",
      });
    }
    const { user } = ensured;

    const generation = await prisma.generation.findFirst({
      where: {
        id: body.generationId,
        userId: user.id,
        deletedAt: null,
        status: "COMPLETED",
      },
    });
    if (!generation || (!generation.r2Key && !generation.resultUrl)) {
      return apiError("Asset not found in Cloud Vault", {
        status: 404,
        code: "NOT_FOUND",
      });
    }

    const deliveryUrl = generation.r2Key
      ? await createSignedGetUrl(generation.r2Key)
      : process.env.NODE_ENV === "production"
        ? null
        : generation.resultUrl;
    if (!deliveryUrl) {
      return apiError("Private media is unavailable for signed delivery", {
        status: 503,
        code: "PRIVATE_MEDIA_UNAVAILABLE",
      });
    }

    let fee = 0;
    let balanceAfter = user.coins;

    if (body.archive) {
      const firstUnlock = await prisma.coinLedger.findFirst({
        where: {
          userId: user.id,
          generationId: generation.id,
          reason: { startsWith: "archive_first_download:" },
        },
      });

      if (!firstUnlock) {
        await prisma.coinLedger.create({
          data: {
            userId: user.id,
            delta: 0,
            type: "ADJUSTMENT",
            reason: `archive_first_download:${generation.id}`,
            generationId: generation.id,
            jobId: generation.id,
            balanceAfter: user.coins,
            metadata: { free: true },
          },
        });
        fee = 0;
      } else {
        fee = ARCHIVE_REDOWNLOAD_FEE_NC;
        const updated = await prisma.$transaction(async (tx) => {
          const debit = await tx.user.updateMany({
            where: { id: user.id, coins: { gte: fee } },
            data: { coins: { decrement: fee } },
          });
          if (debit.count === 0) return null;
          const after = await tx.user.findUniqueOrThrow({
            where: { id: user.id },
          });
          await tx.coinLedger.create({
            data: {
              userId: user.id,
              delta: -fee,
              type: "CHARGE",
              reason: `archive_redownload:${generation.id}`,
              generationId: generation.id,
              jobId: generation.id,
              balanceAfter: after.coins,
              metadata: { feeNc: fee },
            },
          });
          return after.coins;
        });
        if (updated === null) {
          return apiError("Insufficient NC for Cloud Vault re-download", {
            status: 402,
            code: "INSUFFICIENT",
          });
        }
        balanceAfter = updated;
      }
    }

    return apiJson({
      success: true,
      ok: true,
      url: deliveryUrl,
      signedUrl: deliveryUrl,
      feeNc: fee,
      balanceAfter,
      currency: "NC",
      message:
        fee > 0
          ? `Cloud Vault re-download · ${fee} NC`
          : "First Cloud Vault unlock · free",
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Redownload failed", {
      status: 400,
      code: "REDOWNLOAD_FAILED",
    });
  }
}
