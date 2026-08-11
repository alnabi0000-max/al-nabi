import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { guardSensitiveRequest } from "@/lib/security/request-guard";

/** FFmpeg chiqargan kadrni xizmat qilish */
export async function GET(req: NextRequest) {
  const blocked = await guardSensitiveRequest(req);
  if (blocked) return blocked;

  const job = req.nextUrl.searchParams.get("job");
  const iRaw = req.nextUrl.searchParams.get("i") || "1";
  if (!job || /[^a-zA-Z0-9_-]/.test(job)) {
    return NextResponse.json({ error: "Invalid job" }, { status: 400 });
  }
  const iNum = Number.parseInt(iRaw, 10);
  if (!Number.isInteger(iNum) || iNum < 1 || iNum > 100) {
    return NextResponse.json({ error: "Invalid frame index" }, { status: 400 });
  }
  const i = String(iNum);
  const storage = process.env.STORAGE_DIR || "./storage";
  const root = path.resolve(storage, "viral");
  const file = path.resolve(root, job, `frame_${i}.jpg`);
  if (!file.startsWith(root + path.sep)) {
    return NextResponse.json({ error: "Invalid job" }, { status: 400 });
  }
  try {
    const buf = await fs.readFile(file);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Frame not found" }, { status: 404 });
  }
}
