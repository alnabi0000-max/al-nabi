import { NextRequest, NextResponse } from "next/server";
import {
  isOAuthProviderEnabled,
  oauthProbePayload,
  type SocialOAuthProvider,
} from "@/lib/auth/oauth-providers";

export const dynamic = "force-dynamic";

function asProvider(value: string | null): SocialOAuthProvider | null {
  if (value === "google" || value === "apple") return value;
  return null;
}

function json(payload: {
  ok: true;
  google?: boolean;
  apple?: boolean;
}) {
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Guest-safe probe. Pass ?provider=google to check only that provider so a
 * hung Apple check cannot freeze the Google button.
 *
 * Unknown (`null`) must not serialize as `false` — that made the Google
 * button show "coming soon" whenever GoTrue timed out.
 */
export async function GET(request: NextRequest) {
  const only = asProvider(request.nextUrl.searchParams.get("provider"));
  if (only) {
    const enabled = await isOAuthProviderEnabled(only);
    return json({
      ok: true,
      ...oauthProbePayload(only, enabled),
    });
  }

  const [google, apple] = await Promise.all([
    isOAuthProviderEnabled("google"),
    isOAuthProviderEnabled("apple"),
  ]);

  return json({
    ok: true,
    ...oauthProbePayload("google", google),
    ...oauthProbePayload("apple", apple),
  });
}
