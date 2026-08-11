"use client";

import { useIsMounted } from "@/hooks/useIsMounted";

export function ClientOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const isMounted = useIsMounted();
  if (!isMounted) return <>{fallback}</>;
  return <>{children}</>;
}
