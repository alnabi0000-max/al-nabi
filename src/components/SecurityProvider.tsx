"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { isSoftClientSecurity } from "@/lib/security/client-mode";

/**
 * SEC-03: Silent screen-recording detection.
 * Oddiy ko‘rishda overlay yo‘q. Faqat getDisplayMedia / capture aniqlansa media blackout.
 */
export function SecurityProvider({ children }: { children: ReactNode }) {
  const capturing = useRef(false);

  const applyCaptureLock = useCallback((on: boolean) => {
    capturing.current = on;
    document.documentElement.classList.toggle("alnabiy-capture-lock", on);
    document
      .querySelectorAll<HTMLElement>(
        "video, canvas.alnabiy-secure-canvas, [data-alnabiy-secure]"
      )
      .forEach((el) => {
        el.style.filter = on ? "brightness(0)" : "";
        el.style.opacity = on ? "0" : "";
      });
    window.dispatchEvent(
      new CustomEvent("alnabiy:capture", { detail: { active: on } })
    );
  }, []);

  useEffect(() => {
    if (isSoftClientSecurity()) return;

    const md = navigator.mediaDevices;
    const originalGdm = md?.getDisplayMedia?.bind(md);

    if (md && originalGdm) {
      md.getDisplayMedia = async (constraints) => {
        applyCaptureLock(true);
        try {
          const stream = await originalGdm(constraints);
          const unlock = () => applyCaptureLock(false);
          stream.getTracks().forEach((track) => {
            track.addEventListener("ended", unlock);
          });
          return stream;
        } catch (err) {
          applyCaptureLock(false);
          throw err;
        }
      };
    }

    /** Page Visibility API — ba’zi recorderlar tab-hide qiladi; soft pause video */
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && capturing.current) {
        document.querySelectorAll("video").forEach((v) => {
          try {
            v.pause();
          } catch {
            /* soft */
          }
        });
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (md && originalGdm) md.getDisplayMedia = originalGdm;
      document.documentElement.classList.remove("alnabiy-capture-lock");
      applyCaptureLock(false);
    };
  }, [applyCaptureLock]);

  return <>{children}</>;
}
