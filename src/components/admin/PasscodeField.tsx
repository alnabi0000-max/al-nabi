"use client";

import { useState, type Ref } from "react";
import { Eye, EyeOff } from "lucide-react";
import clsx from "clsx";

export function PasscodeField({
  value,
  onChange,
  placeholder,
  autoComplete,
  inputRef,
  id,
  showLabel,
  hideLabel,
  rounded = "xl",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  inputRef?: Ref<HTMLInputElement>;
  id?: string;
  showLabel: string;
  hideLabel: string;
  rounded?: "xl" | "2xl";
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete ?? "off"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={clsx(
          "w-full border border-nabi-border bg-nabi-input pl-4 pr-12 text-sm text-nabi-ink outline-none ring-nabi-neon/40 placeholder:text-nabi-muted focus:ring-2",
          rounded === "2xl" ? "rounded-2xl py-3" : "rounded-xl py-2.5"
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-nabi-muted transition hover:bg-nabi-elevated hover:text-nabi-ink"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
