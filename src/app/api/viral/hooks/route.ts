import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateViralPack } from "@/lib/viral-hooks";
import { guardSensitiveRequest } from "@/lib/security/request-guard";
import {
  ensureRequestLedgerUser,
  isSoftAuthEnabled,
} from "@/lib/auth/ensure-request-user";

const schema = z.object({
  videoUrl: z.string().optional().nullable(),
  scriptOrPrompt: z.string().min(2).max(4000),
  emotionMode: z.string().optional(),
  durationSec: z.number().min(1).max(600).optional(),
  jobId: z.string().optional(),
  locale: z.string().optional(),
  alnabiyKey: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const blocked = await guardSensitiveRequest(req);
    if (blocked) return blocked;

    const body = schema.parse(await req.json());

    const ensured = await ensureRequestLedgerUser({
      alnabiyKey: body.alnabiyKey,
      allowGuest: isSoftAuthEnabled(),
    });
    if (!ensured) {
      return NextResponse.json(
        { ok: false, code: "AUTH_REQUIRED", error: "Sign in required" },
        { status: 401 }
      );
    }
    const locale =
      body.locale ||
      req.headers.get("x-alnabiy-locale") ||
      req.cookies.get("alnabiy_locale")?.value;
    const pack = await generateViralPack({ ...body, locale });
    return NextResponse.json({ ok: true, pack });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Viral pack failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
