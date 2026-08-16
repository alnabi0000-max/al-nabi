"use client";

import { useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";

/**
 * Stripe Embedded Checkout — Apple Pay, Google Pay, and cards (Elements).
 */
export function StripeEmbeddedCheckout({
  clientSecret,
  publishableKey,
  onComplete,
}: {
  clientSecret: string;
  publishableKey: string;
  onComplete?: () => void;
}) {
  const stripePromise = useMemo(
    () => loadStripe(publishableKey),
    [publishableKey]
  );

  return (
    <div className="glass-card min-h-[28rem] overflow-hidden rounded-2xl">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{
          clientSecret,
          onComplete,
        }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
