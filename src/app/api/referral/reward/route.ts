import { NextResponse } from "next/server";

/**
 * Referral rewards must be ledger-backed after a verified purchase.
 * The previous stub minted NC to anyone who POSTed — disabled.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      reward: 0,
      code: "REFERRAL_DISABLED",
      error:
        "Referral rewards are disabled until purchase-verified ledger crediting is enabled.",
    },
    { status: 501 }
  );
}
