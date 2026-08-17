"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DailyIncomePoint,
  PackBreakdownRow,
} from "@/lib/admin/analytics";

const ACCENT = "#e8c547";
const GOLD = "#38bdf8";
const GRID = "rgba(148, 163, 184, 0.18)";
const TICK = "#94a3b8";

function usdTick(value: number): string {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value}`;
}

function ChartTooltip({
  active,
  payload,
  label,
  valuePrefix,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string }>;
  label?: string;
  valuePrefix?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div className="glass-modal px-3 py-2 text-xs">
      <p className="text-nabi-muted">{label}</p>
      <p className="mt-1 font-semibold tabular-nums text-nabi-ink">
        {valuePrefix === "$"
          ? `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : Number(value).toLocaleString("en-US")}
      </p>
    </div>
  );
}

export function AdminIncomeChart({ data }: { data: DailyIncomePoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: TICK, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tick={{ fill: TICK, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={usdTick}
            width={48}
          />
          <Tooltip
            content={(props) => (
              <ChartTooltip
                active={props.active}
                payload={props.payload as Array<{ value?: number }> | undefined}
                label={props.label as string | undefined}
                valuePrefix="$"
              />
            )}
          />
          <Area
            type="monotone"
            dataKey="revenueUsd"
            name="Revenue"
            stroke={ACCENT}
            strokeWidth={2}
            fill="url(#adminRevenueFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AdminPackChart({ data }: { data: PackBreakdownRow[] }) {
  const rows = data.map((row) => ({
    ...row,
    label: `$${row.priceUsd}`,
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: TICK, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: TICK, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={usdTick}
            width={48}
          />
          <Tooltip
            content={(props) => (
              <ChartTooltip
                active={props.active}
                payload={props.payload as Array<{ value?: number }> | undefined}
                label={props.label as string | undefined}
                valuePrefix="$"
              />
            )}
          />
          <Bar
            dataKey="revenueUsd"
            name="Revenue"
            fill={GOLD}
            radius={[8, 8, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
