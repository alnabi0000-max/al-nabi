"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Clapperboard,
  Lock,
  Scale,
  Sparkles,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Internal admin chrome only — mounted under `/admin/*` after the gate.
 * Public navigation never links here.
 */
export function AdminPanelNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
    { href: "/admin", label: t.admin.navAnalytics, icon: BarChart3, exact: true },
    { href: "/admin/ledger", label: t.admin.navLedger, icon: Scale },
    { href: "/admin/users", label: t.admin.navUsers, icon: Users },
    { href: "/admin/jobs", label: t.admin.navJobs, icon: Clapperboard },
    { href: "/admin/models", label: t.admin.navModels, icon: Sparkles },
    { href: "/admin/settings", label: t.admin.navSettings, icon: Lock },
  ];

  return (
    <nav
      aria-label={t.admin.navAnalytics}
      className="mx-auto mb-6 flex max-w-6xl flex-wrap gap-2"
    >
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
              active
                ? "border-nabi-ink/20 bg-nabi-elevated text-nabi-ink"
                : "border-nabi-border text-nabi-muted hover:bg-nabi-elevated hover:text-nabi-ink"
            )}
          >
            <Icon size={12} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
