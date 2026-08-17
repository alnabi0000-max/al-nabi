import { COIN_NAME } from "@/lib/credits";
import { BILLING_EMAIL, SUPPORT_EMAIL } from "@/lib/support";
import { sendTransactionalEmail } from "@/lib/email/send";

export async function sendPurchaseReceiptEmail(opts: {
  email: string;
  name?: string | null;
  packId: string;
  coins: number;
  bonus: number;
  amountCents: number;
  balanceAfter: number;
  stripeSessionId: string;
}): Promise<void> {
  const app = process.env.NEXT_PUBLIC_APP_URL || "https://alnabiy.app";
  const total = opts.coins + opts.bonus;
  const usd = (opts.amountCents / 100).toFixed(2);
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#111">
      <h1 style="font-size:22px">Al-Nabi · NC receipt</h1>
      <p>Assalomu alaykum${opts.name ? `, ${opts.name}` : ""}.</p>
      <p>To‘lovingiz qabul qilindi. Hisobingizga <strong>${total.toLocaleString()} ${COIN_NAME}</strong> tushdi.</p>
      <ul>
        <li>Paket: ${opts.packId}</li>
        <li>Asosiy: ${opts.coins.toLocaleString()} ${COIN_NAME}</li>
        <li>Bonus: ${opts.bonus.toLocaleString()} ${COIN_NAME}</li>
        <li>To‘lov: $${usd}</li>
        <li>Yangi balans: ${opts.balanceAfter.toLocaleString()} ${COIN_NAME}</li>
        <li>Stripe: <code>${opts.stripeSessionId}</code></li>
      </ul>
      <p><a href="${app}/profile?tab=dokon">Kabinet / do‘kon</a> · <a href="${app}/support">Yordam</a></p>
      <hr/>
      <p style="font-size:12px;color:#666">Savol: ${SUPPORT_EMAIL} · Billing: ${BILLING_EMAIL}</p>
    </div>
  `;

  await sendTransactionalEmail({
    to: opts.email,
    subject: `Al-Nabi — ${total.toLocaleString()} ${COIN_NAME} credited`,
    html,
  });
}
