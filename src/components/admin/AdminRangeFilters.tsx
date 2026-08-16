"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { useLanguage } from "@/context/LanguageContext";
import type { AnalyticsRangeKey } from "@/lib/admin/analytics";

const RANGE_ORDER: AnalyticsRangeKey[] = [
  "today",
  "5days",
  "weekly",
  "monthly",
];

export function AdminRangeFilters({
  range,
  customFrom,
  customTo,
  busy,
  onRange,
  onCustomFrom,
  onCustomTo,
  onApplyCustom,
}: {
  range: AnalyticsRangeKey;
  customFrom: string;
  customTo: string;
  busy?: boolean;
  onRange: (key: AnalyticsRangeKey) => void;
  onCustomFrom: (value: string) => void;
  onCustomTo: (value: string) => void;
  onApplyCustom: (from: string, to: string) => void;
}) {
  const { t } = useLanguage();
  const rangeLabels = useMemo(
    () => ({
      today: t.admin.filterToday,
      "5days": t.admin.filter5Days,
      weekly: t.admin.filterWeek,
      monthly: t.admin.filterMonth,
      custom: t.admin.filterCustom,
    }),
    [t]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {RANGE_ORDER.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onRange(key)}
          className={clsx(
            "rounded-full px-3.5 py-1.5 text-sm transition",
            range === key
              ? "bg-white text-nabi-bg"
              : "border border-nabi-border text-nabi-muted hover:bg-nabi-elevated hover:text-nabi-ink"
          )}
        >
          {rangeLabels[key]}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onRange("custom")}
        className={clsx(
          "rounded-full px-3.5 py-1.5 text-sm transition",
          range === "custom"
            ? "bg-white text-nabi-bg"
            : "border border-nabi-border text-nabi-muted hover:bg-nabi-elevated hover:text-nabi-ink"
        )}
      >
        {rangeLabels.custom}
      </button>
      {range === "custom" && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (customFrom && customTo) onApplyCustom(customFrom, customTo);
          }}
        >
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFrom(e.target.value)}
            className="rounded-xl border border-nabi-border bg-nabi-input px-2.5 py-1.5 text-sm text-nabi-ink"
          />
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomTo(e.target.value)}
            className="rounded-xl border border-nabi-border bg-nabi-input px-2.5 py-1.5 text-sm text-nabi-ink"
          />
          <button
            type="submit"
            disabled={!customFrom || !customTo || busy}
            className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-nabi-bg disabled:opacity-50"
          >
            {t.admin.applyRange}
          </button>
        </form>
      )}
    </div>
  );
}
