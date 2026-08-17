import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";
import {
  BILLING_EMAIL,
  LEGAL_EMAIL,
  SUPPORT_EMAIL,
  SUPPORT_TELEGRAM_URL,
} from "@/lib/support";

export const metadata: Metadata = {
  title: "Support — Al-Nabi",
  description: "Al-Nabi customer support for Studio, NC billing, and downloads",
};

export default function SupportPage() {
  return (
    <LegalDocument title="Support" updated="August 17, 2026">
      <p>
        Studio, NC to‘lovlari va yuklab olish bo‘yicha yordam. Javob odatda 1–2
        ish kuni ichida.
      </p>
      <p>
        Help with Studio generation, NC purchases, and downloads. We typically
        reply within 1–2 business days.
      </p>

      <h2>Aloqa / Contact</h2>
      <ul>
        <li>
          Support:{" "}
          <a className="text-nabi-neon" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </li>
        <li>
          Billing / NC:{" "}
          <a className="text-nabi-neon" href={`mailto:${BILLING_EMAIL}`}>
            {BILLING_EMAIL}
          </a>
        </li>
        <li>
          Legal:{" "}
          <a className="text-nabi-neon" href={`mailto:${LEGAL_EMAIL}`}>
            {LEGAL_EMAIL}
          </a>
        </li>
        {SUPPORT_TELEGRAM_URL ? (
          <li>
            Telegram:{" "}
            <a
              className="text-nabi-neon"
              href={SUPPORT_TELEGRAM_URL}
              rel="noreferrer"
              target="_blank"
            >
              Al-Nabi support
            </a>
          </li>
        ) : null}
      </ul>

      <h2>Tez yechimlar / Quick checks</h2>
      <ul>
        <li>
          Video yoki rasm chiqmasa — NC avtomatik qaytadi. Kabinetdagi
          kvitansiyani tekshiring.
        </li>
        <li>
          If a generation fails, NC is refunded to your ledger. Check Kabinet
          receipts.
        </li>
        <li>
          To‘lov o‘tgan, NC ko‘rinmasa — Stripe session ID ni{" "}
          {BILLING_EMAIL} ga yuboring.
        </li>
        <li>
          4K — yangi generate (alohida upscale emas). Maksimal sifat: 4K, 15s,
          native ovoz.
        </li>
      </ul>

      <h2>Hali yo‘q / Not available yet</h2>
      <p>
        Ovoz tarjimon, Motion Brush, inpaint/outpaint, 8K va referral bonus
        hozircha ochilmagan. Va’da qilinmaydi.
      </p>
    </LegalDocument>
  );
}
