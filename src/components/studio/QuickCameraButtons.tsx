"use client";

import { MoveHorizontal, ZoomIn } from "lucide-react";
import clsx from "clsx";
import type { CameraMovement } from "@/lib/types";

const QUICK_CAMERAS: Array<{ id: CameraMovement; label: string }> = [
  { id: "pan_left", label: "Pan L" },
  { id: "pan_right", label: "Pan R" },
  { id: "zoom_in", label: "Zoom +" },
  { id: "zoom_out", label: "Zoom −" },
];

type Props = {
  value: CameraMovement;
  onChange: (value: CameraMovement) => void;
};

export function QuickCameraButtons({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] text-white/40">
        <MoveHorizontal size={12} />
        <ZoomIn size={12} />
        Pan · Zoom
      </p>
      <div className="grid grid-cols-4 gap-2">
        {QUICK_CAMERAS.map((camera) => {
          const active = value === camera.id;
          return (
            <button
              key={camera.id}
              type="button"
              onClick={() => onChange(active ? "static" : camera.id)}
              className={clsx(
                "nabi-select px-2 py-2 text-[11px]",
                active && "nabi-select-on"
              )}
            >
              {camera.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
