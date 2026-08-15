"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CINEMA_GLASS } from "@/components/studio/studio-primitives";
import { LightingJoystick } from "@/components/studio/LightingJoystick";
import { KeyframeDropzones } from "@/components/studio/KeyframeDropzones";
import { NegativeCanvas } from "@/components/studio/NegativeCanvas";
import { DraftModeSwitch } from "@/components/studio/DraftModeSwitch";
import type {
  LightingJoystickValue,
  NegativeCanvasValue,
  StudioKeyframePair,
} from "@/lib/studio/pro-controls";

export type ProModeCopy = {
  lightingTitle: string;
  lightingHint: string;
  keyframeTitle: string;
  keyframeStart: string;
  keyframeEnd: string;
  keyframeHint: string;
  tooLarge: string;
  canvasTitle: string;
  canvasHint: string;
  canvasClear: string;
  draftTitle: string;
  draftHint: string;
};

type Props = {
  open: boolean;
  showVideoTools: boolean;
  lighting: LightingJoystickValue;
  onLightingChange: (value: LightingJoystickValue) => void;
  keyframes: StudioKeyframePair;
  onKeyframesChange: (value: StudioKeyframePair) => void;
  canvas: NegativeCanvasValue;
  onCanvasChange: (value: NegativeCanvasValue) => void;
  canvasBackground: string | null;
  draftMode: boolean;
  onDraftModeChange: (enabled: boolean) => void;
  copy: ProModeCopy;
};

export function ProModePanel({
  open,
  showVideoTools,
  lighting,
  onLightingChange,
  keyframes,
  onKeyframesChange,
  canvas,
  onCanvasChange,
  canvasBackground,
  draftMode,
  onDraftModeChange,
  copy,
}: Props) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className={`${CINEMA_GLASS} space-y-5 p-4 md:p-5`}>
            <LightingJoystick
              value={lighting}
              onChange={onLightingChange}
              title={copy.lightingTitle}
              hint={copy.lightingHint}
            />
            {showVideoTools && (
              <KeyframeDropzones
                value={keyframes}
                onChange={onKeyframesChange}
                title={copy.keyframeTitle}
                startLabel={copy.keyframeStart}
                endLabel={copy.keyframeEnd}
                hint={copy.keyframeHint}
                tooLarge={copy.tooLarge}
              />
            )}
            <NegativeCanvas
              backgroundUrl={canvasBackground}
              value={canvas}
              onChange={onCanvasChange}
              title={copy.canvasTitle}
              hint={copy.canvasHint}
              clearLabel={copy.canvasClear}
            />
            {showVideoTools && (
              <DraftModeSwitch
                enabled={draftMode}
                onChange={onDraftModeChange}
                title={copy.draftTitle}
                hint={copy.draftHint}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
