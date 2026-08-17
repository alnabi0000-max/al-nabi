"use client";

import { useRef, useState } from "react";
import { useMaster } from "@/context/MasterControllerContext";

interface Props {
  imageUrl?: string | null;
}

export function MotionBrush({ imageUrl }: Props) {
  const { tr } = useMaster();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [active, setActive] = useState(false);

  function paint(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing.current || !active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.fillStyle = "rgba(0, 212, 255, 0.45)";
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!imageUrl) {
    return (
      <div className="nabi-card text-xs text-nabi-muted">
        {tr("motion_need_image")}
      </div>
    );
  }

  return (
    <div className="nabi-card space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-nabi-muted">
          {tr("motion_brush")}
        </h3>
        <button
          type="button"
          onClick={() => setActive((v) => !v)}
          className={`nabi-btn-ghost !py-1 !text-xs ${
            active ? "nabi-select-on" : ""
          }`}
        >
          {active ? tr("motion_on") : tr("motion_off")}
        </button>
      </div>
      <div className="relative overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Brush" className="w-full opacity-80" />
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          onMouseDown={() => {
            drawing.current = true;
          }}
          onMouseUp={() => {
            drawing.current = false;
          }}
          onMouseLeave={() => {
            drawing.current = false;
          }}
          onMouseMove={paint}
        />
      </div>
      <p className="text-[10px] text-nabi-muted">{tr("motion_hint")}</p>
    </div>
  );
}
