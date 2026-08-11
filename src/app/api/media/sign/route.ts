import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveUserByKey } from "@/lib/assets";
import { getLocalSessionUser } from "@/lib/auth/session";
import { createSignedGetUrl } from "@/lib/storage/signed-url";

const schema = z.object({
  generationId: z.string().optional(),
  key: z.string().optional(),
  url: z.string().optional(),
  expiresIn: z.number().min(60).max(86_400).optional(),
});

/**
 * POST — R2/S3 signed URL yoki lokal media URL qaytaradi.
 */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const keyHeader = req.headers.get("x-alnabiy-key");
    const user =
      (await resolveUserByKey(keyHeader)) ||
      (await getLocalSessionUser().catch(() => null));

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

    if (objectKey) {
      const signed = await createSignedGetUrl(
        objectKey,
        body.expiresIn ?? 3600
      );
      if (signed) {
        return NextResponse.json({
          ok: true,
          mode: "signed",
          signedUrl: signed,
          url: signed,
          key: objectKey,
          expiresIn: body.expiresIn ?? 3600,
        });
      }
    }

    // Lokal / public URL
    if (fallbackUrl) {
      let url = fallbackUrl;
      if (
        user?.alnabiyKey &&
        url.startsWith("/api/media/") &&
        !url.includes("key=")
      ) {
        const join = url.includes("?") ? "&" : "?";
        url = `${url}${join}key=${encodeURIComponent(user.alnabiyKey)}`;
      }
      return NextResponse.json({
        ok: true,
        mode: "direct",
        signedUrl: url,
        url,
      });
    }

    return NextResponse.json(
      { ok: false, error: "No media key or URL" },
      { status: 400 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sign failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
