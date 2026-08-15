"use client";

import { StudioDropzone } from "@/components/studio/StudioDropzone";
import type { StudioKeyframePair } from "@/lib/studio/pro-controls";

type Props = {
  value: StudioKeyframePair;
  onChange: (value: StudioKeyframePair) => void;
  title: string;
  startLabel: string;
  endLabel: string;
  hint: string;
  tooLarge: string;
};

export function KeyframeDropzones({
  value,
  onChange,
  title,
  startLabel,
  endLabel,
  hint,
  tooLarge,
}: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
        {title}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <StudioDropzone
          preview={value.startUrl}
          onFile={(_file, dataUrl) =>
            onChange({ ...value, startUrl: dataUrl })
          }
          onClear={() => onChange({ ...value, startUrl: null })}
          title={startLabel}
          hint={hint}
          tooLarge={tooLarge}
        />
        <StudioDropzone
          preview={value.endUrl}
          onFile={(_file, dataUrl) => onChange({ ...value, endUrl: dataUrl })}
          onClear={() => onChange({ ...value, endUrl: null })}
          title={endLabel}
          hint={hint}
          tooLarge={tooLarge}
        />
      </div>
    </div>
  );
}
