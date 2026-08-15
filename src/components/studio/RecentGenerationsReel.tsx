"use client";

import { useEffect, useState } from "react";
import { Clapperboard, ImageIcon } from "lucide-react";
import clsx from "clsx";
import {
  HISTORY_CHANGED_EVENT,
  loadHistory,
  type GenerationRecord,
} from "@/lib/generation-history";
import { CINEMA_GLASS } from "@/components/studio/studio-primitives";

type Props = {
  title: string;
  onSelect: (record: GenerationRecord) => void;
  activeId?: string | null;
};

export function RecentGenerationsReel({ title, onSelect, activeId }: Props) {
  const [items, setItems] = useState<GenerationRecord[]>([]);

  useEffect(() => {
    const refresh = () => setItems(loadHistory().filter((x) => x.mediaUrl));
    refresh();
    window.addEventListener(HISTORY_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(HISTORY_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!items.length) return null;

  return (
    <section className={clsx(CINEMA_GLASS, "p-3 md:p-4")}>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-white/45">
        {title}
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {items.slice(0, 24).map((row) => {
          const video = row.kind !== "image";
          const active = activeId === row.id;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row)}
              className={clsx(
                "group relative h-24 w-40 shrink-0 overflow-hidden rounded-xl border transition",
                active
                  ? "border-cyan-400/80 shadow-[0_0_18px_rgba(34,211,238,0.28)]"
                  : "border-white/10 hover:border-white/30"
              )}
            >
              {video ? (
                <video
                  src={row.mediaUrl || undefined}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.mediaUrl || ""}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-5 text-left text-[10px] text-white/80">
                <span className="inline-flex items-center gap-1 truncate">
                  {video ? <Clapperboard size={10} /> : <ImageIcon size={10} />}
                  {row.title}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
