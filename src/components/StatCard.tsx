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
      "bg-gradient-to-br from-nabi-gold/25 to-fuchsia-500/10 ring-1 ring-nabi-gold/35 shadow-[0_0_16px_rgba(240,171,252,0.25)]",
    icon: "text-nabi-gold",
    value: "text-nabi-gold drop-shadow-[0_0_18px_rgba(240,171,252,0.35)]",
    glow: "bg-fuchsia-400/20",
    sheen: "from-nabi-gold/25 via-fuchsia-400/10 to-transparent",
  },
  rose: {
    iconWrap:
      "bg-gradient-to-br from-rose-400/25 to-pink-500/10 ring-1 ring-rose-400/35 shadow-[0_0_16px_rgba(251,113,133,0.22)]",
    icon: "text-rose-300",
    value: "text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.18)]",
    glow: "bg-rose-500/18",
    sheen: "from-rose-400/20 via-pink-500/10 to-transparent",
  },
  neon: {
    iconWrap:
      "bg-gradient-to-br from-nabi-neon/25 to-indigo-500/10 ring-1 ring-nabi-neon/35 shadow-[0_0_16px_rgba(167,139,250,0.28)]",
    icon: "text-nabi-neon",
    value: "text-nabi-neon drop-shadow-[0_0_18px_rgba(167,139,250,0.35)]",
    glow: "bg-violet-400/20",
    sheen: "from-nabi-neon/25 via-indigo-400/10 to-transparent",
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
      className="nabi-stat-card group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#1a1f2e] via-[#12151d] to-[#0a0c12] p-4 shadow-[0_8px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-300 ease-apple hover:-translate-y-1.5 hover:border-white/20 hover:shadow-[0_16px_40px_rgba(0,0,0,0.55),0_0_28px_rgba(168,85,247,0.22),inset_0_1px_0_rgba(255,255,255,0.1)]"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${a.sheen} opacity-80`}
      />
      <div
        className={`pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full ${a.glow} blur-3xl transition-opacity duration-300 group-hover:opacity-100`}
      />
      <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />

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
        <p className="relative mt-1.5 text-[11px] leading-snug text-zinc-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
