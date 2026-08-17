"use client";

import { useCallback, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import clsx from "clsx";
import { CINEMA_GLASS } from "@/components/studio/studio-primitives";

type Props = {
  preview: string | null;
  onFile: (file: File, dataUrl: string) => void;
  onClear: () => void;
  title: string;
  hint: string;
  tooLarge: string;
};

export function StudioDropzone({
  preview,
  onFile,
  onClear,
  title,
  hint,
  tooLarge,
}: Props) {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 5 * 1024 * 1024) {
        setError(tooLarge);
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onload = () => onFile(file, String(reader.result));
      reader.readAsDataURL(file);
    },
    [onFile, tooLarge]
  );

  return (
    <div className="space-y-1.5">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) handle(f);
        }}
        className={clsx(
          CINEMA_GLASS,
          "relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden transition",
          drag
            ? "nabi-select-on"
            : "hover:border-white/20"
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="h-32 w-full object-cover"
          />
        ) : (
          <>
            <ImagePlus className="text-white/40" size={22} />
            <p className="text-sm text-white/70">{title}</p>
            <p className="text-[11px] text-white/40">{hint}</p>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
          }}
        />
      </label>
      {preview && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white"
        >
          <X size={12} />
          Clear reference
        </button>
      )}
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
}
