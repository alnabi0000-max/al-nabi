import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { assertMediaAccess } from "@/lib/assets";

/**
 * Storage media — ownership guard (jobs/* faqat egasi)
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const parts = (await ctx.params).path || [];
  if (
    !parts.length ||
    parts.some(
      (p) => !p || p.includes("..") || p.includes("\\") || /^[a-zA-Z]:/.test(p)
    )
  ) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const alnabiyKey =
    req.headers.get("x-alnabiy-key") ||
    req.nextUrl.searchParams.get("key") ||
    null;

  const access = await assertMediaAccess({
    pathParts: parts,
    alnabiyKey,
  });
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error || "Forbidden" },
      { status: access.status }
    );
  }

  const storage = process.env.STORAGE_DIR || "./storage";
  const root = path.resolve(storage);
  const filePath = path.resolve(root, ...parts);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Soft-deleted marker
  if (parts[0] === "jobs" && parts[1]) {
    try {
      await fs.access(path.join(storage, "jobs", parts[1], ".deleted"));
      return NextResponse.json({ error: "Gone" }, { status: 410 });
    } catch {
      /* not deleted */
    }
  }

  try {
    const buf = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type =
      ext === ".mp3"
        ? "audio/mpeg"
        : ext === ".m4a"
          ? "audio/mp4"
          : ext === ".mp4"
          ? "video/mp4"
          : ext === ".png"
            ? "image/png"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : ext === ".webp"
                ? "image/webp"
                : ext === ".json"
                  ? "application/json"
                  : "application/octet-stream";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
