"use client";

import { useEffect, useRef } from "react";
import { Eraser } from "lucide-react";
import type { NegativeCanvasValue } from "@/lib/studio/pro-controls";

type Props = {
  backgroundUrl: string | null;
  value: NegativeCanvasValue;
  onChange: (value: NegativeCanvasValue) => void;
  title: string;
  hint: string;
  clearLabel: string;
};

export function NegativeCanvas({
  backgroundUrl,
  value,
  onChange,
  title,
  hint,
  clearLabel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef(value.strokeCount);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!value.dataUrl) {
      strokes.current = 0;
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = value.dataUrl;
  }, [value.dataUrl]);

  function paint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas || !drawing.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    ctx.fillStyle = "rgba(244, 63, 94, 0.45)";
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    strokes.current += 1;
  }

  function commit() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange({
      dataUrl: canvas.toDataURL("image/png"),
      strokeCount: strokes.current,
    });
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.current = 0;
    onChange({ dataUrl: null, strokeCount: 0 });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
          {title}
        </p>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white"
        >
          <Eraser size={12} />
          {clearLabel}
        </button>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/50">
        {backgroundUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backgroundUrl}
            alt=""
            className="h-40 w-full object-cover opacity-70"
          />
        ) : (
          <div className="h-40 w-full bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(0,0,0,0.4))]" />
        )}
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          onPointerDown={(e) => {
            drawing.current = true;
            paint(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => paint(e.clientX, e.clientY)}
          onPointerUp={commit}
          onPointerLeave={commit}
        />
      </div>
      <p className="text-[11px] text-white/40">{hint}</p>
    </div>
  );
}
