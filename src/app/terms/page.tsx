import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Terms of Service — Al-Nabi",
  description: "Al-Nabi Terms of Service and acceptable use policy",
};

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Service" updated="August 6, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern access to and use of
        the Al-Nabi AI video platform, websites, APIs, and related services
        (the &quot;Service&quot;) operated by Al-Nabi (&quot;we&quot;,
        &quot;us&quot;). By creating an account or using the Service you agree
        to these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        Al-Nabi provides AI-assisted image and video generation, scripting
        tools, NC-based billing (&quot;NC&quot; = Nabi Credits), and media
        storage. Features may change, be rate-limited, or discontinued as we
        improve the platform.
      </p>

      <h2>2. Accounts &amp; security</h2>
      <ul>
        <li>You must provide accurate registration information.</li>
        <li>
          You are responsible for safeguarding license keys, passwords, and
          session credentials.
        </li>
        <li>
          We may suspend or ban accounts for abuse, fraud, chargebacks, or
          policy violations.
        </li>
      </ul>

      <h2>3. NC &amp; billing</h2>
      <p>
        NC (Nabi Credits) is a prepaid digital balance used to pay for
        generation and related features. NC prices, packs, and geo-based rates
        may vary. Purchases are processed by Stripe (or demo mode in
        development). Unused NC may expire if we provide reasonable notice. NC
        has no cash value outside the Service except as required by law or our
        Refund Policy.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to use the Service to create, upload, or request:</p>
      <ul>
        <li>Illegal, exploitative, or sexually explicit content involving minors</li>
        <li>Non-consensual intimate imagery or deepfakes of real people</li>
        <li>Terrorism, violent crime instructions, or weapons trafficking</li>
        <li>Hate, harassment, or doxxing content</li>
        <li>Malware, scraping, or attempts to bypass security / rate limits</li>
        <li>Content that violates intellectual property or publicity rights</li>
      </ul>
      <p>
        We use automated filters (including AI-based content moderation and
        internal Sentinel / Halol shields). Violations may result in immediate
        termination without refund.
      </p>

      <h2>5. Intellectual property</h2>
      <p>
        Subject to third-party model licenses and applicable law, you retain
        rights in prompts you submit and outputs you lawfully generate, while
        granting Al-Nabi a license to host, process, and display content as
        needed to operate the Service. Preview watermarks and brand marks remain
        our property.
      </p>

      <h2>6. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED &quot;AS IS&quot;. AI outputs may be inaccurate,
        offensive, or unsuitable. We do not guarantee uptime, model
        availability, or fitness for a particular purpose to the maximum extent
        permitted by law.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Al-Nabi&apos;s aggregate
        liability arising from the Service shall not exceed the greater of (a)
        the amounts you paid us for NC in the 3 months preceding the claim,
        or (b) USD $50.
      </p>

      <h2>8. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate
        access for Terms violations, legal risk, or non-payment.
      </p>

      <h2>9. Governing law</h2>
      <p>
        These Terms are governed by the laws of England and Wales, without
        regard to conflict-of-law rules, unless mandatory consumer protections
        in your country of residence apply.
      </p>

      <h2>10. Contact</h2>
      <p>
        Legal inquiries:{" "}
        <a className="text-nabi-neon" href="mailto:legal@alnabiy.app">
          legal@alnabiy.app
        </a>
      </p>
    </LegalDocument>
  );
}
