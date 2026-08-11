"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MainShell } from "@/components/MainShell";
import { ProducerChatTrigger } from "@/components/ProducerChatTrigger";
import { CreditsBadge } from "@/components/CreditsBadge";

const Sidebar = dynamic(
  () => import("@/components/Sidebar").then((m) => ({ default: m.Sidebar })),
  { ssr: false }
);

const MobileNav = dynamic(
  () =>
    import("@/components/MobileNav").then((m) => ({ default: m.MobileNav })),
  { ssr: false }
);

const LanguageDropdown = dynamic(
  () =>
    import("@/components/LanguageDropdown").then((m) => ({
      default: m.LanguageDropdown,
    })),
  { ssr: false }
);

const StudioProfileMenu = dynamic(
  () =>
    import("@/components/StudioProfileMenu").then((m) => ({
      default: m.StudioProfileMenu,
    })),
  { ssr: false }
);

const AppToast = dynamic(
  () => import("@/components/AppToast").then((m) => ({ default: m.AppToast })),
  { ssr: false }
);

const SiteFooter = dynamic(
  () =>
    import("@/components/SiteFooter").then((m) => ({ default: m.SiteFooter })),
  { ssr: false }
);

const ClientHeavyChrome = dynamic(
  () =>
    import("@/components/ClientHeavyChrome").then((m) => ({
      default: m.ClientHeavyChrome,
    })),
  { ssr: false }
);

/** Client chrome — defer non-critical chrome until after first paint. */
export function AppShellChrome({ children }: { children: React.ReactNode }) {
  const [chromeReady, setChromeReady] = useState(false);

  useEffect(() => {
    let idleId: number | undefined;
    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
      idleId = ric(() => setChromeReady(true), { timeout: 1200 });
      return () => window.cancelIdleCallback?.(idleId!);
    }
    const t = window.setTimeout(() => setChromeReady(true), 200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      {chromeReady ? <AppToast /> : null}
      {chromeReady ? <Sidebar /> : null}
      <MainShell>
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/5 bg-[#090A0F]/90 px-4 py-3 md:px-8">
          <p className="text-sm font-semibold tracking-wide text-zinc-100 md:hidden">
            Al-Nabi
          </p>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ProducerChatTrigger />
            {chromeReady ? <LanguageDropdown /> : null}
            <CreditsBadge />
            {chromeReady ? <StudioProfileMenu /> : null}
          </div>
        </header>
        <main className="relative px-4 py-6 pb-24 md:px-8 md:pb-8">
          {children}
        </main>
        {chromeReady ? <SiteFooter /> : null}
      </MainShell>
      {chromeReady ? <MobileNav /> : null}
      {chromeReady ? <ClientHeavyChrome /> : null}
    </>
  );
}
