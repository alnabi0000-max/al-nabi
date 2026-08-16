import { NextResponse } from "next/server";
import {
  ADMIN_GATE_COOKIE,
  ADMIN_GATE_TTL_SEC,
  issueAdminGateToken,
} from "@/lib/admin/gate-token";

export function adminGateCookieOptions(maxAge = ADMIN_GATE_TTL_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

export async function attachAdminGateCookie(
  res: NextResponse,
  tokenVersion: number
): Promise<NextResponse> {
  const token = await issueAdminGateToken(tokenVersion);
  res.cookies.set(ADMIN_GATE_COOKIE, token, adminGateCookieOptions());
  return res;
}

export function clearAdminGateCookie(res: NextResponse): NextResponse {
  res.cookies.set(ADMIN_GATE_COOKIE, "", {
    ...adminGateCookieOptions(0),
    maxAge: 0,
  });
  return res;
}
