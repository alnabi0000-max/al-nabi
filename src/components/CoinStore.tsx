"use client";

import { PricingView } from "@/components/payments/PricingView";

/** Official NC Store — fixed $20–$100 packages */
export function CoinStore() {
  return <PricingView variant="store" />;
}
