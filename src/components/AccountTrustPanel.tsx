"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  FileWarning,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useMaster } from "@/context/MasterControllerContext";

type Consent = {
  document: "TERMS" | "PRIVACY" | "AI_MEDIA_PROCESSING" | "PRODUCT_IMPROVEMENT";
  version: string;
  granted: boolean;
  requiredForGeneration: boolean;
  withdrawable: boolean;
};

type PrivacyRequest = {
  id: string;
  type: "DATA_EXPORT" | "ACCOUNT_ERASURE";
  status: string;
  holdReason: string | null;
  errorCode: string | null;
  createdAt: string;
};

type TrustState = {
  consents: Consent[];
  entitlements: Array<{
    code: string;
    source: string;
    endsAt: string | null;
  }>;
  privacyRequests: PrivacyRequest[];
  safety: {
    policyVersion: string;
    message: string;
    recentOutcomes: Array<{
      surface: string;
      outcome: "ALLOW" | "BLOCK" | "REVIEW" | "UNAVAILABLE";
      createdAt: string;
    }>;
  };
};

const consentLabels: Record<Consent["document"], string> = {
  TERMS: "Terms of Service",
  PRIVACY: "Privacy Policy",
  AI_MEDIA_PROCESSING: "AI media processing",
  PRODUCT_IMPROVEMENT: "Optional product improvement",
};

function requestError(data: unknown, fallback: string): string {
  return typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
    ? data.error
    : fallback;
}

/**
 * Minimal self-service governance surface. Policy messages come from the API;
 * it deliberately never renders moderation categories, prompts, media URLs, or
 * billing provider payloads.
 */
export function AccountTrustPanel() {
  const { tr } = useMaster();
  const [state, setState] = useState<TrustState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [erasureText, setErasureText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/account/trust", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const data = (await response.json()) as TrustState & { error?: string };
    if (!response.ok) throw new Error(requestError(data, "Trust status unavailable."));
    setState(data);
  }, []);

  useEffect(() => {
    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Trust status unavailable.");
    });
  }, [load]);

  async function saveConsent(
    document: Consent["document"],
    action: "GRANTED" | "WITHDRAWN"
  ) {
    setBusy(`consent:${document}`);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/account/consents", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(requestError(data, "Could not save consent."));
      await load();
      setMessage(
        action === "GRANTED"
          ? "Consent recorded."
          : "Optional consent withdrawn. Future processing that needs it is disabled."
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save consent.");
    } finally {
      setBusy(null);
    }
  }

  async function acceptRequired() {
    setBusy("required");
    setError(null);
    setMessage(null);
    try {
      for (const document of ["TERMS", "PRIVACY", "AI_MEDIA_PROCESSING"] as const) {
        const response = await fetch("/api/account/consents", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document, action: "GRANTED" }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(requestError(data, "Could not save consent."));
      }
      await load();
      setMessage("Required agreements recorded. You can now submit media requests.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save consent.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadExport() {
    setBusy("export");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/privacy/requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "DATA_EXPORT" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(requestError(data, "Could not prepare export."));
      const blob = new Blob([JSON.stringify(data.export, null, 2)], {
        type: "application/json",
      });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "al-nabi-account-export.json";
      link.click();
      URL.revokeObjectURL(href);
      await load();
      setMessage("Your scoped account export was downloaded.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Could not prepare export.");
    } finally {
      setBusy(null);
    }
  }

  async function requestErasure() {
    setBusy("erasure");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/privacy/requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ACCOUNT_ERASURE",
          confirmation: erasureText,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(requestError(data, "Could not submit erasure request."));
      await load();
      setErasureText("");
      const status = data.request?.status;
      setMessage(
        status === "COMPLETED"
          ? "Account content erasure completed."
          : status === "HELD"
            ? "Your erasure request is held by a retention requirement."
            : status === "FAILED"
              ? "Your erasure request failed and remains visible for follow-up."
              : "Your erasure request is pending."
      );
    } catch (erasureError) {
      setError(
        erasureError instanceof Error
          ? erasureError.message
          : "Could not submit erasure request."
      );
    } finally {
      setBusy(null);
    }
  }

  if (!state && !error) {
    return (
      <section className="nabi-card flex items-center gap-2 text-sm text-nabi-muted">
        <LoaderCircle className="animate-spin" size={16} />
        Loading account trust status…
      </section>
    );
  }

  const missingRequired =
    state?.consents.filter((consent) => consent.requiredForGeneration && !consent.granted) ??
    [];
  const latestErasure = state?.privacyRequests.find(
    (request) => request.type === "ACCOUNT_ERASURE"
  );

  return (
    <section className="nabi-card space-y-5" aria-label="Account trust and privacy">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 shrink-0 text-nabi-neon" size={19} />
        <div>
          <h3 className="text-sm font-semibold">{tr("trust_title")}</h3>
          <p className="mt-1 text-xs text-nabi-muted">
            {state?.safety.message ||
              "Consent, entitlement, and safety checks protect paid media requests."}
          </p>
        </div>
      </div>

      {missingRequired.length > 0 && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs">
          <p className="mb-2 text-amber-200">
            {tr("trust_required_notice")}
          </p>
          <button
            type="button"
            className="nabi-btn-primary !py-2 text-xs"
            disabled={busy !== null}
            onClick={acceptRequired}
          >
            {busy === "required" ? "Saving…" : tr("trust_accept_required")}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {state?.consents.map((consent) => (
          <div
            key={consent.document}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-nabi-border px-3 py-2 text-xs"
          >
            <span>
              {consentLabels[consent.document]} · v{consent.version}
            </span>
            <span className={consent.granted ? "text-nabi-neon" : "text-amber-200"}>
              {consent.granted ? "Recorded" : "Not accepted"}
            </span>
            {consent.withdrawable &&
              (consent.granted ? (
                <button
                  type="button"
                  className="text-nabi-muted underline"
                  disabled={busy !== null}
                  onClick={() => saveConsent(consent.document, "WITHDRAWN")}
                >
                  Withdraw
                </button>
              ) : (
                <button
                  type="button"
                  className="text-nabi-neon underline"
                  disabled={busy !== null}
                  onClick={() => saveConsent(consent.document, "GRANTED")}
                >
                  Accept
                </button>
              ))}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-nabi-border p-3 text-xs">
        <p className="font-medium">{tr("trust_entitlement")}</p>
        {state?.entitlements.length ? (
          <ul className="mt-2 space-y-1 text-nabi-muted">
            {state.entitlements.map((entitlement) => (
              <li key={`${entitlement.code}:${entitlement.source}`}>
                <Check className="mr-1 inline text-nabi-neon" size={13} />
                {entitlement.code}
                {entitlement.endsAt
                  ? ` · ends ${new Date(entitlement.endsAt).toLocaleDateString()}`
                  : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-nabi-muted">
            {tr("trust_no_entitlement")}
          </p>
        )}
      </div>

      {state?.safety.recentOutcomes.length ? (
        <div className="rounded-lg border border-nabi-border p-3 text-xs">
          <p className="font-medium">{tr("trust_safety_outcomes")}</p>
          <ul className="mt-2 space-y-1 text-nabi-muted">
            {state.safety.recentOutcomes.map((outcome) => (
              <li key={`${outcome.surface}:${outcome.createdAt}`}>
                <span
                  className={
                    outcome.outcome === "ALLOW"
                      ? "text-nabi-neon"
                      : outcome.outcome === "REVIEW"
                        ? "text-amber-200"
                        : "text-red-300"
                  }
                >
                  {outcome.outcome}
                </span>
                {" · "}
                {outcome.surface.replaceAll("-", " ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="nabi-btn-ghost flex items-center gap-2 !py-2 text-xs"
          disabled={busy !== null}
          onClick={downloadExport}
        >
          <Download size={14} />
          {busy === "export" ? "Preparing export…" : tr("trust_export")}
        </button>
      </div>

      <div className="space-y-2 rounded-lg border border-red-400/20 bg-red-400/5 p-3">
        <p className="flex items-center gap-2 text-xs font-medium text-red-200">
          <FileWarning size={14} />
          {tr("trust_erasure")}
        </p>
        <p className="text-[11px] text-nabi-muted">
          {tr("trust_erasure_hint")}
        </p>
        {latestErasure && (
          <p className="text-[11px] text-nabi-muted">
            Latest request: {latestErasure.status}
            {latestErasure.holdReason ? ` · ${latestErasure.holdReason}` : ""}
            {latestErasure.errorCode ? ` · ${latestErasure.errorCode}` : ""}
          </p>
        )}
        <input
          className="nabi-input !py-2 text-xs"
          value={erasureText}
          onChange={(event) => setErasureText(event.target.value)}
          placeholder='Type "ERASE MY ACCOUNT"'
          autoComplete="off"
        />
        <button
          type="button"
          className="nabi-btn-ghost flex items-center gap-2 !py-2 text-xs text-red-200"
          disabled={busy !== null || erasureText.trim().toUpperCase() !== "ERASE MY ACCOUNT"}
          onClick={requestErasure}
        >
          <AlertTriangle size={14} />
          {busy === "erasure" ? "Processing…" : "Request irreversible erasure"}
        </button>
      </div>

      {(message || error) && (
        <p className={error ? "text-xs text-red-300" : "text-xs text-nabi-neon"}>
          {error || message}
        </p>
      )}
    </section>
  );
}
