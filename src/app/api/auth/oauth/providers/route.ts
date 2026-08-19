import { NextRequest, NextResponse } from "next/server";
import {
  isOAuthProviderEnabled,
  type SocialOAuthProvider,
} from "@/lib/auth/oauth-providers";

export const dynamic = "force-dynamic";

function asProvider(value: string | null): SocialOAuthProvider | null {
  if (value === "google" || value === "apple") return value;
  return null;
}

function json(payload: { ok: true; google: boolean; apple: boolean }) {
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Guest-safe probe. Pass ?provider=google to check only that provider so a
 * hung Apple check cannot freeze the Google button.
 */
export async function GET(request: NextRequest) {
  const only = asProvider(request.nextUrl.searchParams.get("provider"));
  if (only) {
    const enabled = await isOAuthProviderEnabled(only);
    return json({
      ok: true,
      google: only === "google" && enabled === true,
      apple: only === "apple" && enabled === true,
    });
  }

  const [google, apple] = await Promise.all([
    isOAuthProviderEnabled("google"),
    isOAuthProviderEnabled("apple"),
  ]);

  return json({
    ok: true,
    google: google === true,
    apple: apple === true,
  });
}
