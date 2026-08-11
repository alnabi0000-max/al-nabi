import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { attachSessionCookie } from "@/lib/auth/session";
import {
  ensureRequestLedgerUser,
  isSoftAuthEnabled,
} from "@/lib/auth/ensure-request-user";
import { getAuthMode } from "@/lib/auth/config";

const schema = z.object({
  alnabiyKey: z.string().min(6).max(64).optional().nullable(),
});

/**
 * Soft/local: sessiya yoki guest ledger user yaratadi + cookie.
 * Frontend generate oldidan / hydration da chaqiriladi.
 */
export async function POST(req: NextRequest) {
  try {
    let body: z.infer<typeof schema> = {};
    try {
      body = schema.parse(await req.json());
    } catch {
      body = {};
    }

    if (!isSoftAuthEnabled()) {
      const existing = await ensureRequestLedgerUser({
        alnabiyKey: body.alnabiyKey,
        allowGuest: false,
      });
      if (!existing) {
        return NextResponse.json(
          {
            ok: false,
            authenticated: false,
            error: "Sign in required",
            code: "AUTH_REQUIRED",
          },
          { status: 401 }
        );
      }
      return NextResponse.json({
        ok: true,
        mode: getAuthMode(),
        authenticated: true,
        guest: false,
        ...existing.user,
        alnabiy_key: existing.user.alnabiyKey,
      });
    }

    const ensured = await ensureRequestLedgerUser({
      alnabiyKey: body.alnabiyKey,
      allowGuest: true,
    });

    if (!ensured) {
      return NextResponse.json(
        { ok: false, authenticated: false, error: "Auth unavailable" },
        { status: 503 }
      );
    }

    const res = NextResponse.json({
      ok: true,
      mode: "local",
      authenticated: true,
      guest: ensured.guestCreated,
      prismaSynced: true,
      id: ensured.user.id,
      email: ensured.user.email,
      alnabiyKey: ensured.user.alnabiyKey,
      alnabiy_key: ensured.user.alnabiyKey,
      coins: ensured.user.coins,
      referralCode: ensured.user.referralCode,
      status: ensured.user.status,
    });

    return attachSessionCookie(res, {
      id: ensured.user.id,
      email: ensured.user.email,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ensure failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
