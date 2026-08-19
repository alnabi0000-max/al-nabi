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
import { toSafePublicProfile } from "@/lib/auth/public-profile";
import { completePasswordAuth } from "@/lib/auth/password-login";
import { createRouteHandlerClient } from "@/lib/supabase/route-client";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  /** true bo‘lsa yangi akkaunt yaratadi */
  register: z.boolean().optional(),
});

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

/** Email + password. Local store in AUTH_MODE=local; otherwise Supabase. */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase();
    const mode = getAuthMode();

    if (mode === "supabase") {
      const route = createRouteHandlerClient(req);
      if (!route) {
        return jsonError("Auth unavailable", 503);
      }

      const result = await completePasswordAuth({
        supabase: route.supabase,
        email,
        password: body.password,
        register: Boolean(body.register),
      });

      if (!result.ok) {
        return jsonError(result.error, result.status);
      }

      return route.applyCookies(
        NextResponse.json({
          ok: true,
          mode,
          authenticated: true,
          ...toSafePublicProfile(result.user),
          message: "Signed in",
        })
      );
    }

    let user = findUserByEmail(email);

    if (body.register) {
      if (user) {
        return jsonError("Email already registered", 409);
      }
      user = upsertLocalUser({ email, password: body.password });
    } else if (!user || !verifyPassword(user, body.password)) {
      return jsonError("Invalid email or password", 401);
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
      authenticated: true,
      ...payload,
      prismaSynced: Boolean(dbUser),
      message: "Signed in",
    });
    return attachSessionCookie(res, user);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Login failed";
    return jsonError(msg, 400);
  }
}
