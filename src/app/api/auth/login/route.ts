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
import { PUBLIC_AUTH_ERRORS } from "@/lib/auth/password-errors";
import {
  rateLimitSensitive,
  clientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  /** true bo‘lsa yangi akkaunt yaratadi */
  register: z.boolean().optional(),
});

function jsonError(error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ ok: false, error }, { status, headers });
}

/** Email + password. Local store in AUTH_MODE=local; otherwise Supabase. */
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitSensitive(`login:${clientIp(req)}`);
    if (!limited.success) {
      return jsonError(
        PUBLIC_AUTH_ERRORS.rateLimited,
        429,
        rateLimitHeaders(limited)
      );
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(PUBLIC_AUTH_ERRORS.invalid, 400);
    }

    const email = parsed.data.email.toLowerCase();
    const mode = getAuthMode();

    if (mode === "supabase") {
      const route = createRouteHandlerClient(req);
      if (!route) {
        return jsonError(PUBLIC_AUTH_ERRORS.unavailable, 503);
      }

      const result = await completePasswordAuth({
        supabase: route.supabase,
        email,
        password: parsed.data.password,
        register: Boolean(parsed.data.register),
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

    if (parsed.data.register) {
      if (user) {
        return jsonError(PUBLIC_AUTH_ERRORS.taken, 409);
      }
      user = upsertLocalUser({ email, password: parsed.data.password });
    } else if (!user || !verifyPassword(user, parsed.data.password)) {
      return jsonError(PUBLIC_AUTH_ERRORS.invalid, 401);
    }

    if (user.status === "BANNED") {
      return NextResponse.json(
        {
          ok: false,
          error: PUBLIC_AUTH_ERRORS.banned,
          status: "BANNED",
        },
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
  } catch {
    return jsonError(PUBLIC_AUTH_ERRORS.failed, 400);
  }
}
