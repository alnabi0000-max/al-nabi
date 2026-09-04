"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import clsx from "clsx";

type Props = {
  accepted: boolean;
  recording: boolean;
  persistError: boolean;
  labels: {
    before: string;
    and: string;
    after: string;
    terms: string;
    privacy: string;
    ai: string;
    helper: string;
    saving: string;
    saveFailed: string;
  };
  onChange: (next: boolean) => void;
};

export function StudioGenerationConsent({
  accepted,
  recording,
  persistError,
  labels,
  onChange,
}: Props) {
  const helper = persistError
    ? labels.saveFailed
    : recording
      ? labels.saving
      : accepted
        ? null
        : labels.helper;

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          className="sr-only"
          checked={accepted}
          disabled={recording}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span
          aria-hidden
          className={clsx(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
            accepted
              ? "border-nabi-gold/70 bg-nabi-gold/15 text-nabi-gold"
              : "border-white/20 bg-black/40 text-transparent",
            recording && "opacity-60"
          )}
        >
          <Check size={10} strokeWidth={3} />
        </span>
        <span className="text-[11px] leading-relaxed text-white/50">
          {labels.before}{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noreferrer"
            className="text-white/70 underline decoration-white/20 underline-offset-2 transition hover:text-nabi-gold hover:decoration-nabi-gold/50"
            onClick={(event) => event.stopPropagation()}
          >
            {labels.terms}
          </Link>
          {", "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-white/70 underline decoration-white/20 underline-offset-2 transition hover:text-nabi-gold hover:decoration-nabi-gold/50"
            onClick={(event) => event.stopPropagation()}
          >
            {labels.privacy}
          </Link>
          {", "}
          {labels.and}{" "}
          <Link
            href="/privacy#ai-media"
            target="_blank"
            rel="noreferrer"
            className="text-white/70 underline decoration-white/20 underline-offset-2 transition hover:text-nabi-gold hover:decoration-nabi-gold/50"
            onClick={(event) => event.stopPropagation()}
          >
            {labels.ai}
          </Link>{" "}
          {labels.after}
        </span>
      </label>
      {helper ? (
        <p className="pl-7 text-[11px] leading-relaxed text-white/35">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
