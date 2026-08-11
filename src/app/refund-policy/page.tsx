import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Refund Policy — Al-Nabi",
  description: "NC refund and chargeback policy",
};

export default function RefundPolicyPage() {
  return (
    <LegalDocument title="Refund Policy" updated="August 6, 2026">
      <p>
        This Refund Policy explains when Al-Nabi NC purchases may be refunded.
        It forms part of our{" "}
        <a className="text-nabi-neon" href="/terms">
          Terms of Service
        </a>
        .
      </p>

      <h2>1. Nature of NC</h2>
      <p>
        NC are digital prepaid credits consumed by AI generation and
        related features. Once NC are spent on a completed or in-progress
        generation, that portion is generally non-refundable.
      </p>

      <h2>2. Eligible refunds</h2>
      <p>We may issue a full or partial refund (or NC re-credit) if:</p>
      <ul>
        <li>
          You were charged twice for the same Stripe Checkout session due to a
          technical error
        </li>
        <li>
          NC were not delivered to your ledger within 24 hours after a
          successful payment (and we cannot remediate)
        </li>
        <li>
          A verified service outage prevented all generation for a sustained
          period after purchase and unused NC remain
        </li>
        <li>Required by applicable consumer protection law</li>
      </ul>

      <h2>3. Non-refundable situations</h2>
      <ul>
        <li>Change of mind after a successful NC delivery</li>
        <li>Dissatisfaction with AI creative output quality or style</li>
        <li>Account bans for Terms / acceptable-use violations</li>
        <li>Consumed NC on completed, failed-after-retry, or cancelled jobs</li>
        <li>Geo-pricing differences or currency conversion fees from your bank</li>
        <li>Purchases made in demo / test mode without real Stripe settlement</li>
      </ul>

      <h2>4. How to request a refund</h2>
      <p>
        Email{" "}
        <a className="text-nabi-neon" href="mailto:billing@alnabiy.app">
          billing@alnabiy.app
        </a>{" "}
        within <strong>14 days</strong> of the charge and include:
      </p>
      <ul>
        <li>Account email</li>
        <li>Stripe receipt / Checkout session ID</li>
        <li>Approximate purchase time and pack name</li>
        <li>Reason for the request</li>
      </ul>
      <p>
        We typically respond within 5 business days. Approved card refunds are
        issued via Stripe to the original payment method (bank timing may vary).
      </p>

      <h2>5. Chargebacks</h2>
      <p>
        Please contact us before opening a chargeback — most issues can be
        resolved faster. Fraudulent or abusive chargebacks may result in account
        suspension and collection of outstanding amounts.
      </p>

      <h2>6. EU / UK consumers</h2>
      <p>
        If you are a consumer in the EEA or UK purchasing digital content, you
        acknowledge that by purchasing NC and requesting immediate access you
        may lose the 14-day withdrawal right for delivered digital content once
        performance has begun, to the extent permitted by law. Mandatory rights
        that cannot be waived remain unaffected.
      </p>

      <h2>7. Contact</h2>
      <p>
        Billing:{" "}
        <a className="text-nabi-neon" href="mailto:billing@alnabiy.app">
          billing@alnabiy.app
        </a>
        <br />
        Legal:{" "}
        <a className="text-nabi-neon" href="mailto:legal@alnabiy.app">
          legal@alnabiy.app
        </a>
      </p>
    </LegalDocument>
  );
}
