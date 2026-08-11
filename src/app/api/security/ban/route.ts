import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin/auth";
import { getLocalSessionUser } from "@/lib/auth/session";
import { resolveUserByKey } from "@/lib/assets";

const schema = z.object({
  alnabiyKey: z.string().min(4),
  reason: z.string().optional(),
  attempts: z.number().optional(),
});

/**
 * Ban account — owner session (own key) or admin secret only.
 * Never allow anonymous ban-by-key.
 */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const admin = assertAdmin(req);
    const keyHeader = req.headers.get("x-alnabiy-key");
    const session = await getLocalSessionUser().catch(() => null);
    const byHeader = keyHeader
      ? await resolveUserByKey(keyHeader).catch(() => null)
      : null;

    const actorKey =
      session?.alnabiyKey || byHeader?.alnabiyKey || keyHeader || null;
    const isOwner = !!actorKey && actorKey === body.alnabiyKey;

    if (!admin.ok && !isOwner) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    try {
      const user = await prisma.user.update({
        where: { alnabiyKey: body.alnabiyKey },
        data: {
          status: "BANNED",
          securityAttempts: body.attempts ?? 2,
          coins: 0,
        },
      });
      return NextResponse.json({
        ok: true,
        status: user.status,
        reason: body.reason || "halol_violation",
      });
    } catch {
      /* DB down — client already applied local ban; do not fake success for attackers */
      if (!isOwner && !admin.ok) {
        return NextResponse.json(
          { ok: false, error: "Ban unavailable", code: "UNAVAILABLE" },
          { status: 503 }
        );
      }
      return NextResponse.json({
        ok: true,
        status: "BANNED",
        persisted: false,
        note: "DB unavailable — client ban applied",
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ban failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
