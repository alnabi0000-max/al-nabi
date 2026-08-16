"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { PackPriceId } from "@/lib/credits";

export type TopUpCelebration = {
  totalNc: number;
  packName: string;
};

type TopUpUi = {
  open: boolean;
  packId: PackPriceId | null;
  openTopUp: (packId?: PackPriceId | null) => void;
  closeTopUp: () => void;
  celebration: TopUpCelebration | null;
  celebrateTopUp: (payload: TopUpCelebration) => void;
  clearCelebration: () => void;
};

const Ctx = createContext<TopUpUi | null>(null);

export function TopUpUiProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [packId, setPackId] = useState<PackPriceId | null>(null);
  const [celebration, setCelebration] = useState<TopUpCelebration | null>(
    null
  );

  const openTopUp = useCallback((nextPack?: PackPriceId | null) => {
    setPackId(nextPack ?? null);
    setOpen(true);
  }, []);

  const closeTopUp = useCallback(() => {
    setOpen(false);
  }, []);

  const celebrateTopUp = useCallback((payload: TopUpCelebration) => {
    setCelebration(payload);
  }, []);

  const clearCelebration = useCallback(() => setCelebration(null), []);

  const value = useMemo(
    () => ({
      open,
      packId,
      openTopUp,
      closeTopUp,
      celebration,
      celebrateTopUp,
      clearCelebration,
    }),
    [
      open,
      packId,
      openTopUp,
      closeTopUp,
      celebration,
      celebrateTopUp,
      clearCelebration,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTopUpUi() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTopUpUi must be used within TopUpUiProvider");
  return ctx;
}
