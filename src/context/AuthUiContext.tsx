"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type AuthUi = {
  open: boolean;
  openAuth: (tab?: "login" | "magic" | "reset") => void;
  closeAuth: () => void;
  initialTab: "login" | "magic" | "reset";
};

const Ctx = createContext<AuthUi | null>(null);

export function AuthUiProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<"login" | "magic" | "reset">(
    "login"
  );

  const openAuth = useCallback((tab: "login" | "magic" | "reset" = "login") => {
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
