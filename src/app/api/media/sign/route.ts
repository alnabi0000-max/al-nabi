import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureRequestLedgerUser } from "@/lib/auth/ensure-request-user";
import { resolvePrivateDeliveryUrl } from "@/lib/storage/signed-url";

const schema = z.object({
  generationId: z.string().optional(),
  key: z.string().optional(),
  url: z.string().optional(),
  expiresIn: z.number().min(60).max(86_400).optional(),
});

/**
 * POST — owner-authorized R2/S3 signed URL.
 * Persistent media is never returned through a public bucket URL.
 */
export async function POST(req: NextRequest) {
  try {
    if (
      ["key", "alnabiyKey", "alnabiy_key"].some((name) =>
        req.nextUrl.searchParams.has(name)
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "CREDENTIAL_IN_URL",
          error: "Credentials in URL query parameters are not accepted.",
        },
        { status: 400 }
      );
    }

    const body = schema.parse(await req.json());
    const authenticated = await ensureRequestLedgerUser({
      alnabiyKey: req.headers.get("x-alnabiy-key"),
      allowGuest: false,
      request: req,
    });
    const user = authenticated?.user ?? null;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    let objectKey = body.key || null;
    let fallbackUrl = body.url || null;
    let generationId = body.generationId || null;

    if (generationId) {
      const gen = await prisma.generation.findUnique({
        where: { id: generationId },
        select: {
          id: true,
          userId: true,
          r2Key: true,
          resultUrl: true,
          deletedAt: true,
        },
      });
      if (!gen || gen.deletedAt) {
        return NextResponse.json(
          { ok: false, error: "Generation not found" },
          { status: 404 }
        );
      }
      if (gen.userId !== user.id) {
        return NextResponse.json(
          { ok: false, error: "Forbidden" },
          { status: 403 }
        );
      }
      objectKey = gen.r2Key || objectKey;
      fallbackUrl = gen.resultUrl || fallbackUrl;
    } else if (objectKey) {
      /* Bare `key` with no generationId — verify it belongs to the caller
       * before signing, otherwise any authenticated user could sign any
       * object in the bucket (IDOR). */
      const owned = await prisma.generation.findFirst({
        where: { r2Key: objectKey, userId: user.id, deletedAt: null },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json(
          { ok: false, error: "Forbidden", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    const deliveryUrl = await resolvePrivateDeliveryUrl({
      objectKey,
      resultUrl: fallbackUrl,
      expiresInSec: body.expiresIn ?? 3600,
    });
    if (deliveryUrl) {
      const signed = !deliveryUrl.startsWith("/api/media/");
      return NextResponse.json({
        ok: true,
        mode: signed ? "signed" : "local",
        signedUrl: deliveryUrl,
        url: deliveryUrl,
        key: objectKey,
        expiresIn: body.expiresIn ?? 3600,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        code: "PRIVATE_MEDIA_REQUIRED",
        error: "No private media object is available for signed delivery.",
      },
      { status: 409 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sign failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
