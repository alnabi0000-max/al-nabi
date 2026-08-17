export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export type SendEmailResult = { ok: boolean; mode: "resend" | "log" };

/**
 * Transactional email via Resend. Missing key → log only (never throw).
 */
export async function sendTransactionalEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "Al-Nabi <onboarding@alnabiy.app>";

  if (!key) {
    console.info("[Alnabiy] email (log mode)", {
      to: input.to,
      subject: input.subject,
    });
    return { ok: true, mode: "log" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[Alnabiy] email failed", res.status, text);
      return { ok: false, mode: "resend" };
    }
    return { ok: true, mode: "resend" };
  } catch (e) {
    console.warn("[Alnabiy] email error", e);
    return { ok: false, mode: "resend" };
  }
}
