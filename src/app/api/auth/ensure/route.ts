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

/** Resolve the current session to a ledger user. */
export async function POST(req: NextRequest) {
  try {
    let body: z.infer<typeof schema> = {};
    try {
      body = schema.parse(await req.json());
    } catch {
      body = {};
    }

    const mode = getAuthMode();
    if (mode === "supabase") {
      const existing = await ensureRequestLedgerUser({
        request: req,
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
      return NextResponse.json(
        {
          ok: true,
          mode,
          authenticated: true,
          guest: false,
          source: existing.source,
          id: existing.user.id,
          email: existing.user.email,
          coins: existing.user.coins,
          referralCode: existing.user.referralCode,
          status: existing.user.status,
          role: existing.user.role,
          authProvider: existing.user.authProvider,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const ensured = await ensureRequestLedgerUser({
      alnabiyKey: body.alnabiyKey,
      allowGuest: isSoftAuthEnabled(),
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
      role: ensured.user.role,
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
