import { NextRequest, NextResponse } from "next/server";
import { softDeleteAsset } from "@/lib/assets";

/**
 * DELETE — faqat o'z assetini soft-delete
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  let alnabiyKey =
    req.headers.get("x-alnabiy-key") ||
    req.nextUrl.searchParams.get("key") ||
    null;

  try {
    const body = await req.json().catch(() => null);
    if (body?.alnabiyKey) alnabiyKey = body.alnabiyKey;
  } catch {
    /* no body */
  }

  if (!alnabiyKey) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!id || id.includes("..")) {
    return NextResponse.json(
      { ok: false, code: "INVALID", error: "Invalid id" },
      { status: 400 }
    );
  }

  const result = await softDeleteAsset(id, alnabiyKey);
  if (!result.ok) {
    const status =
      result.code === "UNAUTHORIZED"
        ? 401
        : result.code === "NOT_FOUND"
          ? 404
          : 500;
    return NextResponse.json(
      { ok: false, code: result.code, error: "Delete failed" },
      { status }
    );
  }

  return NextResponse.json({ ok: true, id });
}
