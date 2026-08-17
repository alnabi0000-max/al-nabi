"use client";

import { useCallback, useRef } from "react";
import type { LightingJoystickValue } from "@/lib/studio/pro-controls";

type Props = {
  value: LightingJoystickValue;
  onChange: (value: LightingJoystickValue) => void;
  title: string;
  hint: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function LightingJoystick({ value, onChange, title, hint }: Props) {
  const padRef = useRef<HTMLDivElement>(null);

  const applyPointer = useCallback(
    (clientX: number, clientY: number) => {
      const pad = padRef.current;
      if (!pad) return;
      const rect = pad.getBoundingClientRect();
      const nx = clamp((clientX - rect.left) / rect.width, 0, 1);
      const ny = clamp((clientY - rect.top) / rect.height, 0, 1);
      onChange({
        ...value,
        azimuthDeg: Math.round(nx * 360 - 180),
        elevationDeg: Math.round((1 - ny) * 80 - 10),
      });
    },
    [onChange, value]
  );

  const knobX = ((value.azimuthDeg + 180) / 360) * 100;
  const knobY = (1 - (value.elevationDeg + 10) / 80) * 100;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
          {title}
        </p>
        <p className="mt-1 text-[11px] text-white/40">{hint}</p>
      </div>
      <div
        ref={padRef}
        className="relative aspect-square w-full max-w-[220px] cursor-crosshair overflow-hidden rounded-full border border-white/15 bg-[radial-gradient(circle_at_center,rgba(232,197,71,0.16),rgba(9,9,11,0.95))]"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          applyPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          applyPointer(e.clientX, e.clientY);
        }}
      >
        <span
          className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-nabi-gold/80 bg-nabi-gold shadow-gold"
          style={{ left: `${knobX}%`, top: `${knobY}%` }}
        />
      </div>
      <label className="block text-[11px] text-white/45">
        Intensity {value.intensity.toFixed(2)}
        <input
          type="range"
          min={0.2}
          max={3}
          step={0.05}
          value={value.intensity}
          onChange={(e) =>
            onChange({ ...value, intensity: Number(e.target.value) })
          }
          className="mt-1 w-full accent-amber-400"
        />
      </label>
      <p className="font-mono text-[10px] text-white/35">
        az {value.azimuthDeg}° · el {value.elevationDeg}°
      </p>
    </div>
  );
}
