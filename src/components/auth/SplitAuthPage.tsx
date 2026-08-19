"use client";

import dynamic from "next/dynamic";
import { useMaster } from "@/context/MasterControllerContext";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { AuthHeroVideo } from "@/components/auth/AuthHeroVideo";

const LanguageDropdown = dynamic(
  () =>
    import("@/components/LanguageDropdown").then((m) => ({
      default: m.LanguageDropdown,
    })),
  { ssr: false }
);

/**
 * Full-viewport 50/50 auth for guests — video reel left, sign-in right.
 */
export function SplitAuthPage() {
  const { tr } = useMaster();

  return (
    <div className="relative z-20 grid min-h-dvh lg:grid-cols-2">
      <section
        aria-label={tr("auth_split_badge")}
        className="relative hidden min-h-dvh overflow-hidden lg:block"
      >
        <AuthHeroVideo />
      </section>

      <section className="relative flex min-h-dvh flex-col overflow-y-auto bg-[#07080d]">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <p className="text-sm font-semibold tracking-tight text-nabi-ink lg:opacity-0">
            Al-Nabi
          </p>
          <LanguageDropdown />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-6 sm:px-10">
          <div className="w-full max-w-[400px]">
            <div className="mb-6 overflow-hidden rounded-2xl border border-nabi-border lg:hidden">
              <AuthHeroVideo compact />
            </div>
            <AuthPanel variant="page" />
          </div>
        </div>
      </section>
    </div>
  );
}
