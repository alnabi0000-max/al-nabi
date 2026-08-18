"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MainShell } from "@/components/MainShell";
import { ProducerChatTrigger } from "@/components/ProducerChatTrigger";
import { CreditsBadge } from "@/components/CreditsBadge";
import { ChatQueryOpener } from "@/components/ChatQueryOpener";
import { useMaster } from "@/context/MasterControllerContext";
import { HiddenAdminTrigger } from "@/components/admin/HiddenAdminTrigger";
import { isAuthExemptPath } from "@/lib/auth/public-pages";
import { SplitAuthPage } from "@/components/auth/SplitAuthPage";

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

function AuthBootSplash({ label }: { label: string }) {
  return (
    <div
      className="relative z-20 flex min-h-dvh items-center justify-center bg-[#05060a]"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          aria-hidden
          className="h-10 w-10 animate-spin rounded-full border-2 border-nabi-gold/25 border-t-nabi-gold"
        />
        <p className="text-xs tracking-wide text-nabi-muted">{label}</p>
      </div>
    </div>
  );
}

function MinimalPublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-dvh">
      <header className="flex items-center justify-between gap-3 px-4 py-3 md:px-8">
        <Link href="/" className="text-sm font-semibold tracking-tight text-nabi-ink">
          Al-Nabi
        </Link>
        <LanguageDropdown />
      </header>
      <main id="main-content" tabIndex={-1} className="px-4 py-8 outline-none md:px-8">
        {children}
      </main>
    </div>
  );
}

/** Client chrome — guests see only the split auth page, never Studio. */
export function AppShellChrome({ children }: { children: React.ReactNode }) {
  const [chromeReady, setChromeReady] = useState(false);
  const { tr, authReady, isAuthenticated } = useMaster();
  const pathname = usePathname() || "/";
  const exempt = isAuthExemptPath(pathname);

  useEffect(() => {
    if (!isAuthenticated) return;
    let idleId: number | undefined;
    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
      idleId = ric(() => setChromeReady(true), { timeout: 1200 });
      return () => window.cancelIdleCallback?.(idleId!);
    }
    const t = window.setTimeout(() => setChromeReady(true), 200);
    return () => window.clearTimeout(t);
  }, [isAuthenticated]);

  if (!authReady) {
    return <AuthBootSplash label={tr("auth_boot")} />;
  }

  if (!isAuthenticated && !exempt) {
    return (
      <>
        <AppToast />
        <SplitAuthPage />
        <HiddenAdminTrigger />
      </>
    );
  }

  if (!isAuthenticated && exempt) {
    return (
      <>
        <AppToast />
        <MinimalPublicShell>{children}</MinimalPublicShell>
        <HiddenAdminTrigger />
      </>
    );
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[10000] rounded-lg bg-nabi-ink px-4 py-2 text-sm font-medium text-nabi-bg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-nabi-neon"
      >
        {tr("skip_to_content")}
      </a>
      <AppToast />
      {chromeReady ? <Sidebar /> : null}
      <MainShell>
        <div className="studio-reveal">
          <header className="glass-drawer sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-2.5 md:px-8">
            <p className="text-sm font-medium tracking-tight text-nabi-ink md:hidden">
              Al-Nabi
            </p>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <ChatQueryOpener />
              <ProducerChatTrigger />
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
        </div>
      </MainShell>
      {chromeReady ? <MobileNav /> : null}
      {chromeReady ? <ClientHeavyChrome /> : null}
      <HiddenAdminTrigger />
    </>
  );
}
