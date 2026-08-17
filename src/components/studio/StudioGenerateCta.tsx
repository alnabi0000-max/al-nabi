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
      className="nabi-btn-primary flex w-full gap-3 px-5 py-3.5 shadow-gold disabled:cursor-not-allowed disabled:opacity-40"
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
