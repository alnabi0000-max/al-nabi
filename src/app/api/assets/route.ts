import { NextRequest, NextResponse } from "next/server";
import { listUserAssets, getUserBalanceStats } from "@/lib/assets";
import { ensureRequestLedgerUser } from "@/lib/auth/ensure-request-user";

/** GET — foydalanuvchi media kutubxonasi + balans statistikasi */
export async function GET(req: NextRequest) {
  try {
    if (
      ["key", "alnabiyKey", "alnabiy_key"].some((name) =>
        req.nextUrl.searchParams.has(name)
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Credentials in URL query parameters are not accepted.",
          code: "CREDENTIAL_IN_URL",
          assets: [],
        },
        { status: 400 }
      );
    }

    const authenticated = await ensureRequestLedgerUser({
      alnabiyKey: req.headers.get("x-alnabiy-key"),
      allowGuest: false,
      request: req,
    });
    if (!authenticated) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized", code: "UNAUTHORIZED", assets: [] },
        { status: 401 }
      );
    }
    const alnabiyKey = authenticated.user.alnabiyKey;

    const [assets, stats] = await Promise.all([
      listUserAssets(alnabiyKey),
      getUserBalanceStats(alnabiyKey),
    ]);

    return NextResponse.json({
      ok: true,
      assets,
      stats: {
        coins: stats.coins,
        totalSpent: stats.totalSpent,
        totalEarned: stats.totalEarned,
        assetCount: stats.assetCount,
        email: stats.email,
        plan: stats.plan,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Assets unavailable";
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        code: "UNAVAILABLE",
        assets: [],
      },
      { status: 503 }
    );
  }
}
