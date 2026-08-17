"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import type { StyleKey } from "@/lib/credits";

export const CINEMA_GLASS =
  "rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-none";

export type StylePresetId = "cinematic" | "photorealistic" | "anime" | "vintage";

export const STYLE_PRESETS: Array<{
  id: StylePresetId;
  style: StyleKey;
  hint?: string;
}> = [
  { id: "cinematic", style: "cinematic" },
  { id: "photorealistic", style: "realistic" },
  { id: "anime", style: "anime" },
  {
    id: "vintage",
    style: "cinematic",
    hint: "vintage analog film look, faded color grade, film grain, 1970s cinema",
  },
];

export function styleFromPreset(id: StylePresetId): StyleKey {
  return STYLE_PRESETS.find((p) => p.id === id)?.style ?? "cinematic";
}

export function vintageHint(id: StylePresetId): string | undefined {
  return STYLE_PRESETS.find((p) => p.id === id)?.hint;
}

export function GlassCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("bg-transparent", className)}>{children}</div>
  );
}

export function StudioAccordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={clsx(CINEMA_GLASS, "overflow-hidden")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/70 transition hover:text-white"
      >
        {title}
        <ChevronDown
          size={14}
          className={clsx("transition-transform", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-4 py-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ASPECTS: Array<{
  id: "16:9" | "9:16" | "1:1";
  label: string;
  box: string;
}> = [
  { id: "16:9", label: "16:9 Landscape", box: "h-6 w-10" },
  { id: "9:16", label: "9:16 Vertical", box: "h-9 w-5" },
  { id: "1:1", label: "1:1 Square", box: "h-7 w-7" },
];

export function AspectRatioPicker({
  value,
  onChange,
}: {
  value: "16:9" | "9:16" | "1:1";
  onChange: (v: "16:9" | "9:16" | "1:1") => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ASPECTS.map((a) => {
        const active = value === a.id;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            className={clsx(
              "nabi-select flex-col gap-2 px-2 py-3",
              active && "nabi-select-on"
            )}
          >
            <span
              className={clsx(
                "rounded-sm border",
                a.box,
                active ? "border-nabi-gold bg-nabi-gold/20" : "border-white/30"
              )}
            />
            <span
              className={clsx(
                "text-[10px] font-medium",
                active ? "text-nabi-gold" : "text-white/50"
              )}
            >
              {a.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function StylePresets({
  value,
  onChange,
  labels,
}: {
  value: StylePresetId;
  onChange: (id: StylePresetId) => void;
  labels: Record<StylePresetId, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {STYLE_PRESETS.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={clsx(
              "nabi-select px-3 py-1.5 text-xs",
              active && "nabi-select-on"
            )}
          >
            {labels[p.id]}
          </button>
        );
      })}
    </div>
  );
}
