import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  findUserByEmail,
  publicUser,
  upsertLocalUser,
} from "@/lib/auth/local-store";
import { attachSessionCookie } from "@/lib/auth/session";
import { syncLocalUserToPrisma } from "@/lib/auth/sync-local";
import { prisma } from "@/lib/prisma";
import { getAuthMode } from "@/lib/auth/config";

const schema = z.object({
  email: z.string().email(),
  alnabiyKey: z.string().min(6).max(64).optional(),
  alnabiy_key: z.string().min(6).max(64).optional(),
});

/** Local development-only legacy key recovery. */
export async function POST(req: NextRequest) {
  try {
    if (getAuthMode() !== "local") {
      return NextResponse.json(
        {
          ok: false,
          code: "LEGACY_KEY_AUTH_DISABLED",
          error: "Alnabiy key authentication is disabled; use Supabase sign-in.",
        },
        { status: 410 }
      );
    }

    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase();
    const key = body.alnabiyKey || body.alnabiy_key;
    if (!key) {
      return NextResponse.json(
        { ok: false, error: "alnabiyKey required" },
        { status: 400 }
      );
    }

    const existing = findUserByEmail(email);
    if (existing && existing.alnabiyKey !== key) {
      return NextResponse.json(
        { ok: false, error: "Invalid Al-Nabi Key for this email" },
        { status: 401 }
      );
    }

    /* An account may already exist in Prisma (e.g. via Supabase / Stripe)
     * even when there is no local-store record yet. Never let an unproven
     * key silently rebind — and thus hijack — that account's alnabiyKey. */
    if (!existing) {
      const dbExisting = await prisma.user
        .findUnique({ where: { email } })
        .catch(() => null);
      if (dbExisting && dbExisting.alnabiyKey && dbExisting.alnabiyKey !== key) {
        return NextResponse.json(
          { ok: false, error: "Invalid Al-Nabi Key for this email" },
          { status: 401 }
        );
      }
    }

    const user = existing || upsertLocalUser({ email, alnabiyKey: key });

    if (user.status === "BANNED") {
      return NextResponse.json(
        { error: "ACCOUNT PERMANENTLY BANNED", status: "BANNED" },
        { status: 403 }
      );
    }

    const dbUser = await syncLocalUserToPrisma(user);
    const payload = dbUser
      ? {
          id: dbUser.id,
          email: dbUser.email,
          alnabiyKey: dbUser.alnabiyKey,
          alnabiy_key: dbUser.alnabiyKey,
          coins: dbUser.coins,
          referralCode: dbUser.referralCode,
          status: dbUser.status,
        }
      : publicUser(user);

    const res = NextResponse.json({
      ok: true,
      ...payload,
      prismaSynced: Boolean(dbUser),
      sessionToken: "cookie",
      message: "Al-Nabi session restored",
    });
    return attachSessionCookie(res, user);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verify failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
