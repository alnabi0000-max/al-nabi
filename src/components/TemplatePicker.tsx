"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { Play } from "lucide-react";
import { featuredStudioTemplates } from "@/lib/templates/catalog";
import { resolveTemplatePreset } from "@/lib/templates/resolve";
import type { StudioTemplate } from "@/lib/templates/types";
import { TemplatePreviewMedia } from "@/components/templates/TemplatePreviewMedia";

type Props = {
  selectedId: number | null;
  onSelect: (template: StudioTemplate) => void;
};

/** Compact featured strip for Studio — full catalog lives in /templates */
export function TemplatePicker({ selectedId, onSelect }: Props) {
  const featured = useMemo(() => featuredStudioTemplates(6), []);

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {featured.map((tpl) => (
        <FeaturedCard
          key={tpl.id}
          template={tpl}
          active={selectedId === tpl.id}
          onSelect={() => onSelect(tpl)}
        />
      ))}
    </div>
  );
}

function FeaturedCard({
  template,
  active,
  onSelect,
}: {
  template: StudioTemplate;
  active: boolean;
  onSelect: () => void;
}) {
  const resolved = resolveTemplatePreset(template);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "group overflow-hidden rounded-xl border text-left transition",
        active
          ? "border-white/35 bg-white/[0.08]"
          : "border-white/10 bg-black/25 hover:border-white/20"
      )}
    >
      <div className="relative aspect-video bg-zinc-900">
        <TemplatePreviewMedia
          templateId={template.id}
          previewVideo={template.preview_video}
          posterOnly
          videoClassName="opacity-90"
        />
        <span className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <Play size={16} className="text-white" fill="currentColor" />
        </span>
      </div>
      <div className="px-2 py-1.5">
        <p className="truncate text-xs font-medium text-white">
          {template.title}
        </p>
        <p className="truncate text-[10px] text-zinc-500">{resolved.aspect}</p>
      </div>
    </button>
  );
}
