import { NextRequest, NextResponse } from "next/server";
import { listUserAssets, getUserBalanceStats } from "@/lib/assets";

function keyFrom(req: NextRequest, body?: { alnabiyKey?: string | null }) {
  return (
    body?.alnabiyKey ||
    req.headers.get("x-alnabiy-key") ||
    req.nextUrl.searchParams.get("key") ||
    null
  );
}

/** GET — foydalanuvchi media kutubxonasi + balans statistikasi */
export async function GET(req: NextRequest) {
  try {
    const alnabiyKey = keyFrom(req);
    if (!alnabiyKey) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized", code: "UNAUTHORIZED", assets: [] },
        { status: 401 }
      );
    }

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
