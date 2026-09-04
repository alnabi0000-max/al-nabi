import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Privacy Policy — Al-Nabi",
  description: "How Al-Nabi collects, uses, and protects personal data",
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy" updated="August 8, 2026">
      <p>
        This Privacy Policy explains how Al-Nabi (&quot;we&quot;, &quot;us&quot;)
        collects, uses, and shares information when you use our AI media
        platform and related services (the &quot;Service&quot;).
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> email, name, locale, referral codes,
          authentication identifiers and license keys.
        </li>
        <li>
          <strong>Billing data:</strong> payment processor customer IDs,
          purchase history, geo/region tokens for pricing. Card details are
          processed by our payment provider — we do not store full card numbers.
        </li>
        <li>
          <strong>Usage data:</strong> generation prompts, job metadata, NC
          (Nabi Credits) ledger transactions, device/session info, IP address,
          and approximate country for geo-pricing and fraud prevention.
        </li>
        <li>
          <strong>Media:</strong> uploaded reference images and generated
          assets stored in Cloud Vault on our infrastructure or encrypted object
          storage.
        </li>
        <li>
          <strong>Diagnostics:</strong> anonymized error and rate-limit
          analytics to keep Al-Nabi Native Engine reliable.
        </li>
      </ul>

      <h2 id="ai-media">2. AI media processing</h2>
      <p>
        When you generate images or video, we process your prompts, optional
        reference frames, and related job metadata to produce the requested
        output. This processing is required to run Al-Nabi Studio. You can
        review or update related choices later in your account privacy
        settings.
      </p>

      <h2>3. How we use data</h2>
      <ul>
        <li>Provide, secure, and improve the Service</li>
        <li>Process payments and maintain the NC ledger</li>
        <li>Enforce acceptable use (moderation, rate limits)</li>
        <li>Prevent fraud, abuse, and unauthorized access</li>
        <li>Comply with legal obligations and respond to lawful requests</li>
      </ul>

      <h2>4. Legal bases (EEA/UK)</h2>
      <p>
        Where GDPR/UK GDPR applies, we process data based on contract
        performance, legitimate interests (security, product improvement),
        consent (where required), and legal obligations.
      </p>

      <h2>5. Sharing</h2>
      <p>
        We share data only with subprocessors required to operate Al-Nabi,
        under contractual confidentiality. User-facing AI inference is delivered
        exclusively as <strong>Al-Nabi Native Engine</strong> — third-party
        model brands are not exposed in the product UI.
      </p>
      <ul>
        <li>Authentication &amp; database hosting</li>
        <li>Payment processing</li>
        <li>Al-Nabi Native Engine compute (server-side only)</li>
        <li>Cloud Vault object storage</li>
        <li>Operational monitoring &amp; background jobs</li>
      </ul>
      <p>We do not sell personal data.</p>

      <h2>6. Retention</h2>
      <p>
        Account and NC ledger records are kept while your account is active and
        as needed for legal, tax, and dispute purposes. Cloud Vault assets remain
        until you delete them or your account is closed, subject to lawful
        retention. You may request deletion; some ledger rows may be anonymized
        rather than erased to preserve financial integrity.
      </p>

      <h2>7. Security</h2>
      <p>
        We apply industry-standard controls including HTTPS, HttpOnly session
        cookies, WAF/bot filtering, rate limiting, and least-privilege access to
        production secrets. No method of transmission is 100% secure.
      </p>

      <h2>8. International transfers</h2>
      <p>
        Data may be processed in jurisdictions where our infrastructure
        operates. Where required, we rely on appropriate safeguards such as
        Standard Contractual Clauses.
      </p>

      <h2>9. Your rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct,
        delete, export, or restrict processing of your personal data, and to
        object to certain processing. Contact{" "}
        <a className="text-nabi-neon" href="mailto:privacy@alnabiy.app">
          privacy@alnabiy.app
        </a>
        . You may also lodge a complaint with your local supervisory authority.
      </p>

      <h2>10. Children</h2>
      <p>
        The Service is not directed to children under 16 (or the minimum age in
        your jurisdiction). We do not knowingly collect data from children.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may update this Policy. Material changes will be posted on this page
        with a revised &quot;Last updated&quot; date.
      </p>
    </LegalDocument>
  );
}
