import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  findUserByEmail,
  publicUser,
  upsertLocalUser,
  verifyPassword,
} from "@/lib/auth/local-store";
import { attachSessionCookie } from "@/lib/auth/session";
import { getAuthMode } from "@/lib/auth/config";
import { syncLocalUserToPrisma } from "@/lib/auth/sync-local";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  /** true bo‘lsa yangi akkaunt yaratadi */
  register: z.boolean().optional(),
});

/** Local development auth. Production uses Supabase-only authentication. */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase();
    const mode = getAuthMode();

    if (mode !== "local") {
      return NextResponse.json(
        {
          ok: false,
          code: "LOCAL_AUTH_DISABLED",
          error: "Password authentication is disabled; use Supabase sign-in.",
        },
        { status: 410 }
      );
    }

    let user = findUserByEmail(email);

    if (body.register) {
      if (user) {
        return NextResponse.json(
          { ok: false, error: "Email already registered" },
          { status: 409 }
        );
      }
      user = upsertLocalUser({ email, password: body.password });
    } else if (!user || !verifyPassword(user, body.password)) {
      /* Same generic message whether the account exists or not — avoid
       * leaking account existence, and never silently auto-register. */
      return NextResponse.json(
        { ok: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (user.status === "BANNED") {
      return NextResponse.json(
        { ok: false, error: "ACCOUNT PERMANENTLY BANNED", status: "BANNED" },
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
      mode,
      ...payload,
      prismaSynced: Boolean(dbUser),
      message: "Signed in",
    });
    return attachSessionCookie(res, user);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Login failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
