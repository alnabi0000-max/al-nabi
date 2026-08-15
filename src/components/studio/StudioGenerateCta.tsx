"use client";

import { Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  loading: boolean;
  disabled: boolean;
  label: string;
  costLabel: string;
  onClick: () => void;
};

export function StudioGenerateCta({
  loading,
  disabled,
  label,
  costLabel,
  onClick,
}: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 px-5 py-3.5 text-sm font-semibold text-black shadow-[0_0_28px_rgba(34,211,238,0.28)] transition disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Sparkles size={16} />
      )}
      {label}
      <span className="rounded-full bg-black/25 px-2.5 py-0.5 font-mono text-xs tabular-nums">
        {costLabel}
      </span>
    </motion.button>
  );
}
