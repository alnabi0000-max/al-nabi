"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readStoredStudioConsent,
  requiredStudioConsentsGranted,
  STUDIO_REQUIRED_CONSENTS,
  writeStoredStudioConsent,
  type StudioConsentStatus,
} from "@/lib/trust/studio-consent";

export function useStudioGenerationConsent(alnabiyKey?: string | null) {
  const [accepted, setAccepted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [recording, setRecording] = useState(false);
  const [serverGranted, setServerGranted] = useState(false);
  const [persistError, setPersistError] = useState(false);

  const headers = useCallback((): HeadersInit => {
    return {
      "Content-Type": "application/json",
      ...(alnabiyKey ? { "x-alnabiy-key": alnabiyKey } : {}),
    };
  }, [alnabiyKey]);

  const persistToServer = useCallback(async (): Promise<boolean> => {
    setRecording(true);
    setPersistError(false);
    try {
      const results = await Promise.all(
        STUDIO_REQUIRED_CONSENTS.map((document) =>
          fetch("/api/account/consents", {
            method: "PUT",
            credentials: "include",
            headers: headers(),
            body: JSON.stringify({ document, action: "GRANTED" }),
          })
        )
      );
      if (results.some((response) => !response.ok)) {
        setServerGranted(false);
        setPersistError(true);
        return false;
      }
      setServerGranted(true);
      writeStoredStudioConsent(true);
      return true;
    } catch {
      setServerGranted(false);
      setPersistError(true);
      return false;
    } finally {
      setRecording(false);
    }
  }, [headers]);

  useEffect(() => {
    const local = readStoredStudioConsent();
    if (local) setAccepted(true);

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/account/consents", {
          credentials: "include",
          headers: headers(),
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as {
          consents?: StudioConsentStatus[];
        };
        if (cancelled) return;
        if (requiredStudioConsentsGranted(data.consents || [])) {
          setAccepted(true);
          setServerGranted(true);
          writeStoredStudioConsent(true);
          return;
        }
        if (local) await persistToServer();
      } catch {
        /* local checkbox still works; generate() will persist again */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [headers, persistToServer]);

  const setConsent = useCallback(
    async (next: boolean) => {
      setAccepted(next);
      writeStoredStudioConsent(next);
      if (!next) {
        setPersistError(false);
        return;
      }
      await persistToServer();
    },
    [persistToServer]
  );

  return {
    accepted,
    hydrated,
    recording,
    ready: accepted && serverGranted && !recording,
    persistError,
    setConsent,
    ensureRecorded: persistToServer,
  };
}
