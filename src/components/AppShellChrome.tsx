"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MainShell } from "@/components/MainShell";
import { ProducerChatTrigger } from "@/components/ProducerChatTrigger";
import { CreditsBadge } from "@/components/CreditsBadge";
import { ChatQueryOpener } from "@/components/ChatQueryOpener";
import { useMaster } from "@/context/MasterControllerContext";

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

const ThemePicker = dynamic(
  () =>
    import("@/components/ThemePicker").then((m) => ({
      default: m.ThemePicker,
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
  const { tr } = useMaster();

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
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[10000] rounded-lg bg-nabi-ink px-4 py-2 text-sm font-medium text-nabi-bg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-nabi-neon"
      >
        {tr("skip_to_content")}
      </a>
      {chromeReady ? <AppToast /> : null}
      {chromeReady ? <Sidebar /> : null}
      <MainShell>
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-nabi-border bg-nabi-bg/80 px-4 py-2.5 backdrop-blur-md md:px-8">
          <p className="text-sm font-medium tracking-tight text-nabi-ink md:hidden">
            Al-Nabi
          </p>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ChatQueryOpener />
            <ProducerChatTrigger />
            {chromeReady ? <ThemePicker /> : null}
            {chromeReady ? <LanguageDropdown /> : null}
            <CreditsBadge />
            {chromeReady ? <StudioProfileMenu /> : null}
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="relative px-4 py-8 pb-24 outline-none md:px-8 md:py-10"
        >
          {children}
        </main>
        {chromeReady ? <SiteFooter /> : null}
      </MainShell>
      {chromeReady ? <MobileNav /> : null}
      {chromeReady ? <ClientHeavyChrome /> : null}
    </>
  );
}
