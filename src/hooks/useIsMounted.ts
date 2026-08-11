"use client";

import { useEffect, useState } from "react";

/** Hydration-safe: server va birinchi client render bir xil */
export function useIsMounted() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  return isMounted;
}
