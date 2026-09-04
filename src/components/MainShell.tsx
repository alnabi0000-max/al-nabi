"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Floating sidebar uchun asosiy kontent offset.
 */
export function MainShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("alnabiy_sidebar_collapsed") !== "0");
    } catch {
      /* soft */
    }
    const onSidebar = (e: Event) => {
      const detail = (e as CustomEvent<{ collapsed?: boolean }>).detail;
      if (typeof detail?.collapsed !== "boolean") return;
      const next = detail.collapsed;
      queueMicrotask(() => setCollapsed(next));
    };
    window.addEventListener("alnabiy:sidebar", onSidebar as EventListener);
    return () =>
      window.removeEventListener("alnabiy:sidebar", onSidebar as EventListener);
  }, []);

  return (
    <div
      className={
        collapsed
          ? "relative z-10 min-h-dvh transition-[margin] duration-300 md:ml-[5.5rem]"
          : "relative z-10 min-h-dvh transition-[margin] duration-300 md:ml-[15.5rem] lg:ml-[16.5rem]"
      }
    >
      {children}
    </div>
  );
}
