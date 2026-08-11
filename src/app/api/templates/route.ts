import { NextResponse } from "next/server";
import {
  categoryCounts,
  countStudioTemplates,
  listStudioTemplates,
} from "@/lib/templates/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/templates — public Studio template catalog (paginated) */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  const q = searchParams.get("q") || undefined;
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "48", 10) || 48)
  );
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

  const templates = listStudioTemplates(category, { q, limit, offset });
  const total = countStudioTemplates(category, q);

  return NextResponse.json(
    {
      success: true,
      ok: true,
      templates,
      count: templates.length,
      total,
      offset,
      limit,
      categories: categoryCounts(),
    },
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}
