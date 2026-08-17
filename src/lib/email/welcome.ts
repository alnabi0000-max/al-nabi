import { SUPPORT_EMAIL } from "@/lib/support";
import { sendTransactionalEmail } from "@/lib/email/send";

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
  const app = process.env.NEXT_PUBLIC_APP_URL || "https://alnabiy.app";
  const subject = "Welcome to Al-Nabi — your studio is ready";
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#111">
      <h1 style="font-size:22px">Assalomu alaykum${
        payload.name ? `, ${payload.name}` : ""
      }!</h1>
      <p>Al-Nabi Studio’ga xush kelibsiz.</p>
      <p>Hisobingizda <strong>${payload.coins.toLocaleString()}</strong> NC bor. Prompt yozib video yoki rasm yarating — 15 soniya, 4K, native ovoz.</p>
      <p><a href="${app}/">Studio’ga o‘tish →</a> · <a href="${app}/support">Yordam</a></p>
      <hr/>
      <p style="font-size:12px;color:#666">Al-Nabi · ${SUPPORT_EMAIL}</p>
    </div>
  `;

  return sendTransactionalEmail({
    to: payload.email,
    subject,
    html,
  });
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
