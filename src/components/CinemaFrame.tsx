"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

/**
 * Empty or filled cinema canvas — Runway-style preview, no marketing carousel.
 */
export function CinemaFrame({
  children,
  emptyLabel,
  className,
}: {
  children?: ReactNode;
  emptyLabel: string;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "relative aspect-video overflow-hidden rounded-2xl border border-nabi-border bg-[color-mix(in_srgb,var(--nabi-bg)_88%,black)]",
        className
      )}
    >
      {children ? (
        <div className="absolute inset-0">{children}</div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="h-px w-16 bg-nabi-border" />
          <p className="max-w-xs text-sm text-nabi-muted">{emptyLabel}</p>
          <span className="h-px w-16 bg-nabi-border" />
        </div>
      )}
    </div>
  );
}
