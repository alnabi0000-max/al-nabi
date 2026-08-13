"use client";

import { useMemo } from "react";
import { useMaster } from "@/context/MasterControllerContext";
import { WATERMARK } from "@/lib/credits";
import { previewFingerprint } from "@/lib/security/preview-fingerprint";
import clsx from "clsx";

type Props = {
  src: string;
  alt?: string;
  className?: string;
};

/** Still preview with visible forensic watermark; clean file via Download. */
export function SecureStill({ src, alt = "Generated result", className }: Props) {
  const { email, alnabiyKey } = useMaster();
  const fingerprint = useMemo(
    () => previewFingerprint(email, alnabiyKey),
    [email, alnabiyKey]
  );

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-xl border border-nabi-border bg-black",
        className
      )}
      data-alnabiy-secure="1"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        data-alnabiy-secure-still="1"
        className="w-full select-none"
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="rotate-[-18deg] select-none text-center text-sm font-semibold tracking-wide text-white/25 sm:text-base">
          {WATERMARK}
          <br />
          <span className="text-xs opacity-80">{fingerprint}</span>
        </span>
      </div>
      <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
        {WATERMARK} · {fingerprint}
      </div>
    </div>
  );
}
