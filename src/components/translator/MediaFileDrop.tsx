"use client";

import { useState } from "react";
import { FileAudio, FileVideo, X } from "lucide-react";
import clsx from "clsx";
import { CINEMA_GLASS } from "@/components/studio/studio-primitives";

type Props = {
  accept: string;
  maxBytes: number;
  fileName: string | null;
  previewUrl: string | null;
  kind: "video" | "audio";
  title: string;
  hint: string;
  tooLarge: string;
  onFile: (file: File, objectUrl: string) => void;
  onClear: () => void;
};

export function MediaFileDrop({
  accept,
  maxBytes,
  fileName,
  previewUrl,
  kind,
  title,
  hint,
  tooLarge,
  onFile,
  onClear,
}: Props) {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = kind === "video" ? FileVideo : FileAudio;

  function handle(file: File) {
    if (file.size > maxBytes) {
      setError(tooLarge);
      return;
    }
    setError(null);
    onFile(file, URL.createObjectURL(file));
  }

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
          const file = e.dataTransfer.files[0];
          if (file) handle(file);
        }}
        className={clsx(
          CINEMA_GLASS,
          "relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden p-4 transition",
          drag
            ? "nabi-select-on"
            : "hover:border-white/20"
        )}
      >
        {kind === "video" && previewUrl ? (
          <video
            src={previewUrl}
            className="h-36 w-full object-cover"
            muted
            playsInline
            controls
          />
        ) : (
          <>
            <Icon className="text-white/40" size={22} />
            <p className="text-sm text-white/70">{title}</p>
            <p className="text-[11px] text-white/40">{hint}</p>
            {fileName && (
              <p className="max-w-full truncate text-[11px] text-nabi-gold">
                {fileName}
              </p>
            )}
          </>
        )}
        <input
          type="file"
          accept={accept}
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handle(file);
          }}
        />
      </label>
      {fileName && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white"
        >
          <X size={12} />
          {fileName}
        </button>
      )}
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
}
