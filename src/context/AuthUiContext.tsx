"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/**
 * `quick` / `signin` — Google + email/password sign-in
 * `signup` — create account
 * `code`   — passwordless 6-digit email code
 * `reset`  — password recovery
 */
export type AuthTab = "quick" | "signin" | "signup" | "code" | "reset";

type AuthUi = {
  open: boolean;
  openAuth: (tab?: AuthTab) => void;
  closeAuth: () => void;
  initialTab: AuthTab;
};

const Ctx = createContext<AuthUi | null>(null);

export function AuthUiProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<AuthTab>("quick");

  const openAuth = useCallback((tab: AuthTab = "quick") => {
    setInitialTab(tab);
    setOpen(true);
  }, []);

  const closeAuth = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, openAuth, closeAuth, initialTab }),
    [open, openAuth, closeAuth, initialTab]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuthUi() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuthUi must be used within AuthUiProvider");
  return ctx;
}
