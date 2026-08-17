import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Accent = "gold" | "rose" | "neon";

const accentStyles: Record<
  Accent,
  {
    iconWrap: string;
    icon: string;
    value: string;
    glow: string;
    sheen: string;
  }
> = {
  gold: {
    iconWrap:
      "bg-gradient-to-br from-nabi-gold/25 to-nabi-gold/10 ring-1 ring-nabi-gold/35 shadow-gold",
    icon: "text-nabi-gold",
    value: "text-nabi-gold drop-shadow-gold",
    glow: "bg-nabi-gold/20",
    sheen: "from-nabi-gold/25 via-nabi-gold/10 to-transparent",
  },
  rose: {
    iconWrap:
      "bg-gradient-to-br from-rose-400/25 to-rose-500/10 ring-1 ring-rose-400/35",
    icon: "text-rose-400",
    value: "text-nabi-ink",
    glow: "bg-rose-500/18",
    sheen: "from-rose-400/20 via-rose-500/10 to-transparent",
  },
  neon: {
    iconWrap:
      "bg-gradient-to-br from-nabi-neon/25 to-nabi-neon/10 ring-1 ring-nabi-neon/35 shadow-neon",
    icon: "text-nabi-neon",
    value: "text-nabi-neon drop-shadow-neon",
    glow: "bg-nabi-neon/20",
    sheen: "from-nabi-neon/25 via-nabi-neon/10 to-transparent",
  },
};

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: Accent;
  /** Stagger index for entrance animation */
  index?: number;
};

/**
 * Premium dashboard metric card — shared visual shell for balance / spend / assets.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "neon",
  index = 0,
}: StatCardProps) {
  const a = accentStyles[accent];

  return (
    <div
      className="nabi-stat-card group relative overflow-hidden rounded-2xl border border-nabi-border bg-gradient-to-br from-nabi-surface via-nabi-card to-nabi-bg p-4 shadow-glass transition-all duration-300 ease-apple hover:-translate-y-1.5 hover:border-nabi-gold/35 hover:shadow-gold"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${a.sheen} opacity-80`}
      />
      <div
        className={`pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full ${a.glow} blur-3xl transition-opacity duration-300 group-hover:opacity-100`}
      />
      <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-nabi-ink/35 to-transparent" />

      <div className="relative mb-3 flex items-center gap-2.5 text-xs text-nabi-muted">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${a.iconWrap}`}
        >
          <Icon size={15} className={a.icon} aria-hidden />
        </span>
        <span className="leading-snug">{label}</span>
      </div>

      <div
        className={`relative text-3xl font-bold tracking-tight tabular-nums md:text-[2rem] ${a.value}`}
      >
        {value}
      </div>

      {hint ? (
        <p className="relative mt-1.5 text-[11px] leading-snug text-nabi-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
