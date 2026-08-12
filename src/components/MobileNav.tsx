"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clapperboard,
  Home,
  LayoutTemplate,
  User,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "@/context/LanguageContext";

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const links = [
    { href: "/", label: t.nav.home, icon: Home },
    { href: "/generate", label: t.nav.generate, icon: Clapperboard },
    { href: "/templates", label: t.nav.templates, icon: LayoutTemplate },
    { href: "/profile", label: t.nav.profile, icon: User },
    { href: "/balance", label: t.nav.balance, icon: Wallet },
  ];

  return (
    <nav className="fixed bottom-3 left-3 right-3 z-50 flex w-auto overflow-hidden rounded-2xl border border-nabi-border bg-nabi-bg/95 pb-[env(safe-area-inset-bottom)] shadow-glass md:hidden">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(12);
            }}
            className={clsx(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[9px] transition-all duration-300 ease-apple active:scale-[0.92]",
              active
                ? "bg-gradient-to-t from-[var(--accent)]/20 to-transparent text-nabi-ink"
                : "text-nabi-muted"
            )}
          >
            <Icon size={18} />
            <span className="w-full truncate px-0.5 text-center">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
