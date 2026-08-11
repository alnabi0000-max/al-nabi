"use client";

import { useMemo, useState } from "react";
import { LayoutTemplate, Search } from "lucide-react";
import clsx from "clsx";
import {
  categoryCounts,
  listStudioTemplates,
} from "@/lib/templates/catalog";
import {
  TEMPLATE_CATEGORIES,
  type StudioTemplate,
  type TemplateCategory,
} from "@/lib/templates/types";
import { TemplateGridCard } from "@/components/templates/TemplateGridCard";
import { TemplateFastUseDrawer } from "@/components/templates/TemplateFastUseDrawer";
import { useLanguage } from "@/context/LanguageContext";

const PAGE_SIZE = 48;

type Filter = "All" | TemplateCategory;

export function TemplateExplorer() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>("All");
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [active, setActive] = useState<StudioTemplate | null>(null);
  const counts = useMemo(() => categoryCounts(), []);

  const filtered = useMemo(
    () =>
      listStudioTemplates(filter === "All" ? undefined : filter, {
        q: q.trim() || undefined,
      }),
    [filter, q]
  );

  const shown = filtered.slice(0, visible);

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 max-w-2xl">
        <p className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
          <LayoutTemplate size={12} />
          Template Explorer
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Al-Nabi nima yarata oladi
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          {counts.All}+ tayyor uslub. Shablonni tanlang, obyektingizni yozing va
          bir bosishda Studio generatoriga o‘ting.
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["All", ...TEMPLATE_CATEGORIES] as Filter[]).map((cat) => {
            const activeFilter = filter === cat;
            const n = counts[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setFilter(cat);
                  setVisible(PAGE_SIZE);
                }}
                className={clsx(
                  "rounded-full border px-3.5 py-1.5 text-sm transition",
                  activeFilter
                    ? "border-white/30 bg-white text-zinc-950"
                    : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
                )}
              >
                {cat}
                <span
                  className={clsx(
                    "ml-1.5 tabular-nums",
                    activeFilter ? "text-zinc-500" : "text-zinc-400"
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        <label className="relative block w-full sm:max-w-xs">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder={t.common.search}
            className="w-full rounded-full border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/25"
          />
        </label>
      </div>

      <p className="mb-4 text-xs text-zinc-400">
        {filtered.length.toLocaleString()} shablon
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((tpl) => (
          <TemplateGridCard
            key={tpl.id}
            template={tpl}
            onOpen={setActive}
          />
        ))}
      </div>

      {shown.length === 0 && (
        <p className="py-16 text-center text-sm text-zinc-500">
          Hech narsa topilmadi. Filterni o‘zgartiring.
        </p>
      )}

      {visible < filtered.length && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-zinc-200 transition hover:border-white/30 hover:bg-white/5"
          >
            Yana ko‘rsatish ({filtered.length - visible})
          </button>
        </div>
      )}

      <TemplateFastUseDrawer
        open={Boolean(active)}
        template={active}
        onClose={() => setActive(null)}
      />
    </div>
  );
}
