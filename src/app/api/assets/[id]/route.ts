import { NextRequest, NextResponse } from "next/server";
import { softDeleteAsset } from "@/lib/assets";
import { ensureRequestLedgerUser } from "@/lib/auth/ensure-request-user";

/**
 * DELETE — faqat o'z assetini soft-delete
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (
    ["key", "alnabiyKey", "alnabiy_key"].some((name) =>
      req.nextUrl.searchParams.has(name)
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: "CREDENTIAL_IN_URL",
        error: "Credentials in URL query parameters are not accepted.",
      },
      { status: 400 }
    );
  }

  let body: { alnabiyKey?: string | null } | null = null;
  try {
    body = (await req.json().catch(() => null)) as {
      alnabiyKey?: string | null;
    } | null;
  } catch {
    /* no body */
  }

  const authenticated = await ensureRequestLedgerUser({
    alnabiyKey: body?.alnabiyKey || req.headers.get("x-alnabiy-key"),
    allowGuest: false,
  });
  if (!authenticated) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Unauthorized" },
      { status: 401 }
    );
  }
  const alnabiyKey = authenticated.user.alnabiyKey;

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
