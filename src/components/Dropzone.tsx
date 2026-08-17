"use client";

import { useCallback, useState } from "react";
import { Upload } from "lucide-react";
import clsx from "clsx";
import { useMaster } from "@/context/MasterControllerContext";

interface Props {
  onFile: (file: File, previewUrl: string) => void;
}

export function Dropzone({ onFile }: Props) {
  const { tr } = useMaster();
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const handle = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      setPreview(url);
      onFile(file, url);
    },
    [onFile]
  );

  return (
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
        "relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300 ease-apple",
          drag
            ? "border-nabi-gold bg-nabi-gold/10"
            : "border-nabi-border bg-nabi-surface hover:border-nabi-gold/50"
      )}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Uploaded source image preview"
          className="h-full max-h-40 w-full object-cover"
        />
      ) : (
        <>
          <Upload className="text-nabi-muted" size={28} />
          <p className="text-sm text-nabi-muted">{tr("drag_drop_zone")}</p>
          <p className="text-xs text-nabi-muted">{tr("drag_drop_hint")}</p>
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
  );
}
