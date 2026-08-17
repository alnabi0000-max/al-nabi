"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import clsx from "clsx";

type Props = {
  length: number;
  value: string;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  /** Fired once the last digit lands — powers auto-submit. */
  onComplete?: (value: string) => void;
};

const digitsOnly = (raw: string) => raw.replace(/\D/g, "");

/**
 * Segmented numeric code field with auto-advance, backspace rewind, and paste
 * support. Native keyboards get `one-time-code` autofill.
 */
export function OtpCodeInput({
  length,
  value,
  disabled,
  label,
  onChange,
  onComplete,
}: Props) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const completedFor = useRef<string | null>(null);

  useEffect(() => {
    if (value.length === length) {
      if (completedFor.current === value) return;
      completedFor.current = value;
      onComplete?.(value);
    } else {
      completedFor.current = null;
    }
  }, [value, length, onComplete]);

  function focusAt(index: number) {
    const target = inputs.current[Math.max(0, Math.min(length - 1, index))];
    target?.focus();
    target?.select();
  }

  function setDigit(index: number, raw: string) {
    const digits = digitsOnly(raw);
    if (!digits) return;

    // Typing into a box replaces from that position; pasting fills forward.
    const next = (
      value.slice(0, index) +
      digits +
      value.slice(index + digits.length)
    ).slice(0, length);

    onChange(next);
    focusAt(index + digits.length);
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1));
        focusAt(index);
      } else {
        onChange(value.slice(0, Math.max(0, index - 1)));
        focusAt(index - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(index - 1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(index + 1);
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const digits = digitsOnly(e.clipboardData.getData("text")).slice(0, length);
    if (!digits) return;
    e.preventDefault();
    onChange(digits);
    focusAt(digits.length);
  }

  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center justify-between gap-2"
    >
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          disabled={disabled}
          aria-label={`${label} ${i + 1}`}
          value={value[i] ?? ""}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.currentTarget.select()}
          className={clsx(
            "h-14 w-full rounded-xl border bg-white/[0.04] text-center text-xl font-semibold tabular-nums text-white backdrop-blur-xl",
            "transition outline-none focus:border-nabi-gold/60 focus:ring-2 focus:ring-nabi-gold/25",
            "disabled:opacity-50",
            value[i] ? "nabi-select-on" : "border-nabi-border"
          )}
        />
      ))}
    </div>
  );
}
