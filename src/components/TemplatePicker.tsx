"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { featuredStudioTemplates } from "@/lib/templates/catalog";
import { resolveTemplatePreset } from "@/lib/templates/resolve";
import type { StudioTemplate } from "@/lib/templates/types";

type Props = {
  selectedId: number | null;
  onSelect: (template: StudioTemplate) => void;
};

/** Compact, production-ready set of six templates for Studio. */
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
          ? "border-white/35 bg-nabi-elevated"
          : "border-nabi-border bg-nabi-input hover:border-nabi-neon/35"
      )}
    >
      <div className="flex aspect-video flex-col justify-between bg-gradient-to-br from-nabi-elevated to-nabi-surface p-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-nabi-muted">
          {template.category}
        </span>
        <span className="text-xs font-medium text-nabi-ink">{resolved.aspect}</span>
      </div>
      <div className="px-2 py-1.5">
        <p className="truncate text-xs font-medium text-nabi-ink">
          {template.title}
        </p>
        <p className="truncate text-[10px] text-nabi-muted">{resolved.aspect}</p>
      </div>
    </button>
  );
}
