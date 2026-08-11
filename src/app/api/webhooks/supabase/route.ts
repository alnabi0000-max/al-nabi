import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { onboardNewUser } from "@/lib/auth/onboarding";

/**
 * Supabase Database Webhook — auth.users INSERT / public sync.
 * Dashboard: Database → Webhooks → Insert on auth.users
 * Header: x-supabase-signature yoki Authorization: Bearer WEBHOOK_SECRET
 */
export async function POST(req: NextRequest) {
  const secret =
    process.env.SUPABASE_WEBHOOK_SECRET?.trim() ||
    process.env.AUTH_WEBHOOK_SECRET?.trim();

  const raw = await req.text();

  /* Fail closed: an unset secret must never mean "accept any request" —
   * that would let anyone POST a fake auth.users record and mint a
   * signup-grant account (or grant credits to an attacker-controlled id). */
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, error: "Webhook not configured" },
        { status: 503 }
      );
    }
  } else {
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const sig = req.headers.get("x-supabase-signature") || "";
    const okBearer =
      Boolean(bearer) &&
      bearer!.length === secret.length &&
      timingSafeEqual(Buffer.from(bearer!), Buffer.from(secret));
    let okHmac = false;
    if (sig) {
      const expected = createHmac("sha256", secret).update(raw).digest("hex");
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      okHmac = a.length === b.length && timingSafeEqual(a, b);
    }
    if (!okBearer && !okHmac) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    type Meta = { full_name?: string; name?: string };
    type UserRec = {
      id?: string;
      email?: string;
      raw_user_meta_data?: Meta;
      user_metadata?: Meta;
    };
    const body = JSON.parse(raw) as {
      type?: string;
      table?: string;
      schema?: string;
      record?: UserRec;
      user?: UserRec;
    };

    const record: UserRec | undefined = body.record || body.user;
    const id = record?.id;
    const email = record?.email;
    if (!id || !email) {
      return NextResponse.json(
        { ok: false, error: "Missing user id/email" },
        { status: 400 }
      );
    }

    const meta: Meta =
      record?.raw_user_meta_data ||
      record?.user_metadata ||
      {};

    const { user, isNew } = await onboardNewUser(
      {
        id,
        email,
        name: meta.full_name || meta.name || null,
      },
      { source: "supabase_webhook", sendEmail: true }
    );

    return NextResponse.json({
      ok: true,
      isNew,
      userId: user.id,
      coins: user.coins,
      referralCode: user.referralCode,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook failed";
    console.warn("[Alnabiy] supabase webhook", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
