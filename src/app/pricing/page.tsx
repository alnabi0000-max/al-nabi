import type { Metadata } from "next";
import { PricingView } from "@/components/payments/PricingView";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Official Al-Nabi NC packages — Starter to Studiya. 1 NC = $0.01. Apple Pay, Google Pay, and cards.",
};

export default function PricingPage() {
  return (
    <div className="py-2">
      <PricingView variant="page" />
    </div>
  );
}
