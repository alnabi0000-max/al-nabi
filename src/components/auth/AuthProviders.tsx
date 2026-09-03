"use client";

import dynamic from "next/dynamic";
import { AuthUiProvider } from "@/context/AuthUiContext";
import { TopUpUiProvider } from "@/context/TopUpUiContext";

const AuthModal = dynamic(
  () =>
    import("@/components/auth/AuthModal").then((m) => ({ default: m.AuthModal })),
  { ssr: false }
);

const TopUpModal = dynamic(
  () =>
    import("@/components/payments/TopUpModal").then((m) => ({
      default: m.TopUpModal,
    })),
  { ssr: false }
);

const PaymentCelebration = dynamic(
  () =>
    import("@/components/payments/PaymentCelebration").then((m) => ({
      default: m.PaymentCelebration,
    })),
  { ssr: false }
);

const CheckoutReturnHandler = dynamic(
  () =>
    import("@/components/payments/CheckoutReturnHandler").then((m) => ({
      default: m.CheckoutReturnHandler,
    })),
  { ssr: false }
);

const AuthReturnHandler = dynamic(
  () =>
    import("@/components/auth/AuthReturnHandler").then((m) => ({
      default: m.AuthReturnHandler,
    })),
  { ssr: false }
);

/** Global auth + NC top-up modals */
export function AuthProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthUiProvider>
      <TopUpUiProvider>
        {children}
        <AuthModal />
        <AuthReturnHandler />
        <TopUpModal />
        <PaymentCelebration />
        <CheckoutReturnHandler />
      </TopUpUiProvider>
    </AuthUiProvider>
  );
}
