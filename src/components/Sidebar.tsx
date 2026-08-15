"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clapperboard,
  Languages,
  User,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "@/context/LanguageContext";

const LS_SIDEBAR = "alnabiy_sidebar_collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(true);
  const [tip, setTip] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_SIDEBAR);
      if (saved === "0") setCollapsed(false);
      else setCollapsed(true);
    } catch {
      setCollapsed(true);
    }
    const mq = window.matchMedia("(max-width: 1024px)");
    const sync = () => {
      if (mq.matches) setCollapsed(true);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(LS_SIDEBAR, next ? "1" : "0");
      } catch {
        /* soft */
      }
      window.dispatchEvent(
        new CustomEvent("alnabiy:sidebar", { detail: { collapsed: next } })
      );
      return next;
    });
  }

  const links = [
    { href: "/", label: t.nav.studio, icon: Clapperboard },
    { href: "/translator", label: t.nav.translator, icon: Languages },
    { href: "/profile", label: t.nav.cabinet, icon: User },
  ];

  return (
    <aside
      data-collapsed={collapsed ? "1" : "0"}
      className={clsx(
        "fixed left-3 top-3 z-40 hidden h-[calc(100dvh-1.5rem)] flex-col rounded-2xl border border-nabi-border",
        "bg-nabi-bg/95 transition-[width] duration-300 md:flex",
        collapsed ? "w-[4.25rem]" : "w-56 lg:w-60"
      )}
    >
      <div
        className={clsx(
          "flex items-center py-4",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-nabi-ink">
              Al-Nabi
            </h1>
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          className="shrink-0 rounded-xl p-1.5 text-nabi-muted transition hover:bg-nabi-elevated hover:text-nabi-ink"
          aria-label={collapsed ? t.nav.expand : t.nav.collapse}
          title={collapsed ? t.nav.expand : t.nav.collapse}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>

      <nav className="relative flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              onMouseEnter={() => collapsed && setTip(label)}
              onMouseLeave={() => setTip(null)}
              className={clsx(
                "relative flex items-center rounded-2xl py-2.5 text-sm transition-all duration-300 ease-apple",
                collapsed ? "justify-center px-2" : "gap-2.5 px-3",
                active
                  ? "bg-nabi-elevated text-nabi-ink"
                  : "text-nabi-muted hover:bg-nabi-elevated hover:text-nabi-ink"
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="min-w-0 flex-1 truncate">{label}</span>
              )}
            </Link>
          );
        })}
        {collapsed && tip && (
          <div className="pointer-events-none absolute left-full top-1/3 z-50 ml-3 whitespace-nowrap rounded-lg border border-nabi-border bg-[var(--bg-elevated-solid)]/95 px-2.5 py-1.5 text-xs text-nabi-ink shadow-glass backdrop-blur-xl">
            {tip}
          </div>
        )}
      </nav>
    </aside>
  );
}
