"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ProducerChatCtx = {
  open: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
};

const Ctx = createContext<ProducerChatCtx | null>(null);

export function ProducerChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openChat = useCallback(() => setOpen(true), []);
  const closeChat = useCallback(() => setOpen(false), []);
  const toggleChat = useCallback(() => setOpen((v) => !v), []);
  const value = useMemo(
    () => ({ open, openChat, closeChat, toggleChat }),
    [open, openChat, closeChat, toggleChat]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProducerChat() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useProducerChat must be used within ProducerChatProvider");
  }
  return ctx;
}
