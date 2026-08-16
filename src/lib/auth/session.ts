import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthSecret } from "@/lib/auth/config";
import { findUserById, publicUser, type LocalUser } from "@/lib/auth/local-store";

import { SESSION_MAX_AGE_SEC } from "@/lib/auth/session-ttl";

export const AUTH_COOKIE = "alnabiy_auth";
const MAX_AGE_SEC = SESSION_MAX_AGE_SEC; // 365 kun

export interface SessionPayload {
  uid: string;
  email: string;
  exp: number;
}

function sign(body: string): string {
  return createHmac("sha256", getAuthSecret()).update(body).digest("base64url");
}

export function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as SessionPayload;
    if (!payload?.uid || !payload?.email || !payload?.exp) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function attachSessionCookie(
  res: NextResponse,
  user: Pick<LocalUser, "id" | "email">
) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Local authentication cookies are disabled in production; use the Supabase session."
    );
  }

  const token = encodeSession({
    uid: user.id,
    email: user.email,
    exp: Date.now() + MAX_AGE_SEC * 1000,
  });
  res.cookies.set(AUTH_COOKIE, token, sessionCookieOptions());
  return res;
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  return res;
}

/**
 * Joriy local sessiya → Prisma User (sync).
 * Generate / ledger uchun `id` Prisma `users` da bo‘lishi shart.
 */
export async function getLocalSessionUser() {
  if (process.env.NODE_ENV === "production") return null;

  const jar = await cookies();
  const payload = decodeSession(jar.get(AUTH_COOKIE)?.value);
  if (!payload) return null;
  const local = findUserById(payload.uid);
  if (!local || local.status === "BANNED") return null;

  try {
    const { syncLocalUserToPrisma } = await import("@/lib/auth/sync-local");
    const dbUser = await syncLocalUserToPrisma(local);
    if (dbUser) return dbUser;
  } catch {
    /* soft — local fallback */
  }
  return local;
}

export async function getLocalSessionPublic() {
  const user = await getLocalSessionUser();
  if (!user) return null;
  if ("passwordHash" in user) {
    return publicUser(user as LocalUser);
  }
  return {
    id: user.id,
    email: user.email,
    alnabiyKey: user.alnabiyKey,
    alnabiy_key: user.alnabiyKey,
    coins: user.coins,
    referralCode: user.referralCode,
    status: user.status,
  };
}
