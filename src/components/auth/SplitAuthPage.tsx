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
 * Full-bleed AI reel with a glass sign-in card floating on the right.
 */
export function SplitAuthPage() {
  const { tr } = useMaster();

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <AuthHeroVideo />

      <div className="relative z-10 flex min-h-dvh flex-col lg:flex-row lg:justify-end">
        <header className="flex items-center justify-between px-5 py-4 lg:absolute lg:right-0 lg:top-0 lg:z-20 lg:w-[min(100%,34rem)] lg:px-10 lg:py-6">
          <p className="text-sm font-semibold tracking-tight text-white drop-shadow lg:hidden">
            {tr("auth_split_badge")}
          </p>
          <div className="ml-auto">
            <LanguageDropdown />
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 pb-10 pt-2 lg:w-[34rem] lg:flex-none lg:px-10">
          <div className="auth-glass-panel w-full max-w-[400px] rounded-3xl border border-white/20 p-6 sm:p-7">
            <AuthPanel variant="page" />
          </div>
        </div>
      </div>
    </div>
  );
}
