"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, Languages, User } from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "@/context/LanguageContext";

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const links = [
    { href: "/", label: t.nav.studio, icon: Clapperboard },
    { href: "/translator", label: t.nav.translator, icon: Languages },
    { href: "/profile", label: t.nav.cabinet, icon: User },
  ];

  return (
    <nav className="fixed bottom-3 left-3 right-3 z-50 flex w-auto overflow-hidden rounded-2xl border border-nabi-border bg-nabi-bg/95 pb-[env(safe-area-inset-bottom)] md:hidden">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);
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
                ? "bg-nabi-elevated text-nabi-ink"
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
