"use client";

import clsx from "clsx";
import { Play } from "lucide-react";
import type { StudioTemplate } from "@/lib/templates/types";
import { resolveTemplatePreset } from "@/lib/templates/resolve";
import { TemplatePreviewMedia } from "@/components/templates/TemplatePreviewMedia";

type Props = {
  template: StudioTemplate;
  onOpen: (template: StudioTemplate) => void;
};

export function TemplateGridCard({ template, onOpen }: Props) {
  const resolved = resolveTemplatePreset(template);

  return (
    <button
      type="button"
      onClick={() => onOpen(template)}
      className={clsx(
        "group relative overflow-hidden rounded-2xl border border-nabi-border bg-nabi-bg/80 text-left",
        "transition duration-300",
        "hover:-translate-y-0.5 hover:border-nabi-neon/35"
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-nabi-surface">
        <TemplatePreviewMedia
          templateId={template.id}
          previewVideo={template.preview_video}
          loadOnHover
          videoClassName="opacity-80 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
        />
        <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <span className="pointer-events-none absolute left-2.5 top-2.5 z-[3] rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-nabi-ink">
          {template.category}
        </span>
        <span className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-nabi-neon/35 bg-black/55">
            <Play size={16} className="ml-0.5 text-white" fill="currentColor" />
          </span>
        </span>
      </div>
      <div className="space-y-1 px-3 py-3">
        <p className="truncate text-sm font-semibold text-nabi-ink">
          {template.title}
        </p>
        <p className="truncate text-[11px] text-nabi-muted">
          {resolved.publicModelLabel} · {resolved.aspect}
        </p>
      </div>
    </button>
  );
}
