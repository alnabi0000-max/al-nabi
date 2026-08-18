"use client";

import dynamic from "next/dynamic";
import { Sparkles } from "lucide-react";
import { useMaster } from "@/context/MasterControllerContext";
import { AuthPanel } from "@/components/auth/AuthPanel";

const VideoShowcasePanel = dynamic(
  () =>
    import("@/components/VideoShowcasePanel").then((m) => ({
      default: m.VideoShowcasePanel,
    })),
  { ssr: false }
);

const LanguageDropdown = dynamic(
  () =>
    import("@/components/LanguageDropdown").then((m) => ({
      default: m.LanguageDropdown,
    })),
  { ssr: false }
);

/**
 * Full-viewport 50/50 auth for guests — showcase left, sign-in right.
 * Authenticated users never see this: AppShellChrome swaps to Studio.
 */
export function SplitAuthPage() {
  const { tr } = useMaster();

  return (
    <div className="relative z-20 grid min-h-dvh lg:grid-cols-2">
      <section
        aria-label={tr("auth_split_badge")}
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1428] via-[#0b0d14] to-[#05060a]" />
          <div className="absolute -left-24 -top-28 h-[28rem] w-[28rem] rounded-full bg-amber-400/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-16 h-[32rem] w-[32rem] rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute left-1/3 top-1/3 h-64 w-64 rounded-full bg-violet-600/15 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_transparent_20%,_rgba(5,6,10,0.55)_100%)]" />
        </div>

        <div className="relative flex h-full flex-col justify-between px-10 py-12 xl:px-14">
          <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-nabi-gold">
            <Sparkles size={14} />
            {tr("auth_split_badge")}
          </div>

          <div className="max-w-xl space-y-6">
            <h1 className="font-display text-4xl font-semibold leading-[1.12] tracking-tight text-white xl:text-5xl">
              {tr("auth_split_headline")}
            </h1>
            <p className="max-w-md text-base leading-relaxed text-white/70">
              {tr("auth_split_subhead")}
            </p>
            <VideoShowcasePanel compact className="shadow-[0_24px_80px_rgba(0,0,0,0.45)]" />
            <ul className="flex flex-wrap gap-2 pt-1 text-[11px] text-white/60">
              <li className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {tr("auth_feature_1")}
              </li>
              <li className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {tr("auth_feature_2")}
              </li>
              <li className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {tr("auth_feature_3")}
              </li>
            </ul>
          </div>

          <p className="text-[11px] text-white/40">Al-Nabi · AI Video Studio</p>
        </div>
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
              <div className="bg-gradient-to-br from-amber-400/15 via-violet-600/10 to-sky-500/10 px-4 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-nabi-gold">
                  {tr("auth_split_badge")}
                </p>
                <h1 className="mt-2 font-display text-xl font-semibold leading-snug text-white">
                  {tr("auth_split_headline")}
                </h1>
              </div>
            </div>
            <AuthPanel variant="page" />
          </div>
        </div>
      </section>
    </div>
  );
}
