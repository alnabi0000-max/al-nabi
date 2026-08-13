import { REFERRAL_REWARD, DEMO_STARTING_CREDITS } from "@/lib/credits";

export type WelcomePayload = {
  email: string;
  name?: string | null;
  coins: number;
  referralCode?: string;
};

/**
 * Welcome / marketing email.
 * RESEND_API_KEY bo‘lsa Resend orqali yuboradi; aks holda log (soft).
 */
export async function sendWelcomeEmail(
  payload: WelcomePayload
): Promise<{ ok: boolean; mode: "resend" | "log" }> {
  const subject = "Welcome to Al-Nabi — your bonus NC are ready";
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#111">
      <h1 style="font-size:22px">Assalomu alaykum${
        payload.name ? `, ${payload.name}` : ""
      }!</h1>
      <p>Alnabiy AI platformasiga xush kelibsiz.</p>
      <p><strong>${payload.coins.toLocaleString()}</strong> NC hisobingizga qo‘shildi.</p>
      <p>Prompt-to-Video va Script-to-Movie bilan birinchi asaringizni yarating.</p>
      ${
        payload.referralCode
          ? `<p>Referral kodingiz: <code>${payload.referralCode}</code> — do‘stingiz sotib olsa +${REFERRAL_REWARD} NC.</p>`
          : ""
      }
      <p><a href="${
        process.env.NEXT_PUBLIC_APP_URL || "https://alnabiy.app"
      }/">Studio’ga o‘tish →</a></p>
      <hr/>
      <p style="font-size:12px;color:#666">Alnabiy · legal@alnabiy.app</p>
    </div>
  `;

  const key = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "Alnabiy <onboarding@alnabiy.app>";

  if (key) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.email],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[Alnabiy] welcome email failed", res.status, text);
      return { ok: false, mode: "resend" };
    }
    return { ok: true, mode: "resend" };
  }

  console.info("[Alnabiy] welcome email (log mode)", {
    to: payload.email,
    coins: payload.coins || DEMO_STARTING_CREDITS,
  });
  return { ok: true, mode: "log" };
}

/** Oddiy marketing list yozuvi (webhook / ESP sync) */
export async function upsertMarketingContact(opts: {
  email: string;
  name?: string | null;
  source: string;
}): Promise<void> {
  const url = process.env.MARKETING_WEBHOOK_URL?.trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.MARKETING_WEBHOOK_SECRET
          ? {
              Authorization: `Bearer ${process.env.MARKETING_WEBHOOK_SECRET}`,
            }
          : {}),
      },
      body: JSON.stringify({
        email: opts.email,
        name: opts.name,
        source: opts.source,
        list: "alnabiy-users",
        at: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.warn("[Alnabiy] marketing webhook failed", e);
  }
}
