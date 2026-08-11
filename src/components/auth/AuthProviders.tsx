"use client";

import dynamic from "next/dynamic";
import { AuthUiProvider } from "@/context/AuthUiContext";

const AuthModal = dynamic(
  () =>
    import("@/components/auth/AuthModal").then((m) => ({ default: m.AuthModal })),
  { ssr: false }
);

/** Global auth modal + openAuth() context — modal code-split */
export function AuthProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthUiProvider>
      {children}
      <AuthModal />
    </AuthUiProvider>
  );
}
