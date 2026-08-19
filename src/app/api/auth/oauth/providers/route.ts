import { NextResponse } from "next/server";
import { isOAuthProviderEnabled } from "@/lib/auth/oauth-providers";

export const dynamic = "force-dynamic";

/**
 * Guest-safe probe so the sign-in page can hide disabled providers instead of
 * dumping the user on a raw GoTrue JSON 400 ("provider is not enabled").
 */
export async function GET() {
  const [google, apple] = await Promise.all([
    isOAuthProviderEnabled("google"),
    isOAuthProviderEnabled("apple"),
  ]);

  return NextResponse.json(
    {
      ok: true,
      google: google === true,
      apple: apple === true,
      googleEnabled: google === true,
      appleEnabled: apple === true,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
