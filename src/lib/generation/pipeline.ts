import { sanitizeGenerationError } from "@/lib/generation/public-error";

export type PipelineStage = "queue" | "mock-persist" | "player-render";

export type PipelineStepStatus = "ok" | "error" | "recovered";

export type GenerationErrorCode =
  | "QUEUE_FAILED"
  | "MOCK_PERSIST_FAILED"
  | "PLAYER_RENDER_FAILED"
  | "CHARGE_FAILED"
  | "PROVIDER_FAILED"
  | "DELIVERY_FAILED"
  | "GENERATION_NOT_FOUND"
  | "GENERATION_BUSY"
  | "NETWORK_RESET"
  | "TIMEOUT"
  | "EMPTY_RESULT"
  | "GENERATION_FAILED";

export type PipelineLogEntry = {
  at: string;
  stage: PipelineStage;
  status: PipelineStepStatus;
  code?: GenerationErrorCode | string;
  message: string;
};

export const LOCAL_FALLBACK_VIDEO = "/dev-mock/preview.mp4";
export const LOCAL_FALLBACK_IMAGE = "/dev-mock/preview.png";

export function localFallbackMedia(kind: "image" | "video"): string {
  return kind === "image" ? LOCAL_FALLBACK_IMAGE : LOCAL_FALLBACK_VIDEO;
}

const MOCK_RECOVERABLE_CODES: ReadonlySet<GenerationErrorCode> = new Set([
  "MOCK_PERSIST_FAILED",
  "NETWORK_RESET",
  "EMPTY_RESULT",
  "TIMEOUT",
  "PROVIDER_FAILED",
  "DELIVERY_FAILED",
  "PLAYER_RENDER_FAILED",
  "GENERATION_FAILED",
]);

/** Persist/network/empty failures may complete with /dev-mock/* locally. */
export function isRecoverableLocalMockFailure(
  code?: string | null
): boolean {
  if (!code) return true;
  return MOCK_RECOVERABLE_CODES.has(code as GenerationErrorCode);
}

export function classifyGenerationFailure(
  err: unknown,
  hint: PipelineStage = "queue"
): {
  message: string;
  code: GenerationErrorCode;
  stage: PipelineStage;
} {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  const message = sanitizeGenerationError(err);

  if (/not found/i.test(raw)) {
    return { message, code: "GENERATION_NOT_FOUND", stage: hint };
  }
  if (/already in progress/i.test(raw)) {
    return { message, code: "GENERATION_BUSY", stage: "queue" };
  }
  if (/insufficient|INSUFFICIENT|charge/i.test(raw)) {
    return { message, code: "CHARGE_FAILED", stage: "queue" };
  }
  if (/econnreset|econnaborted|epipe|socket hang up|network reset/i.test(raw)) {
    return { message, code: "NETWORK_RESET", stage: "mock-persist" };
  }
  if (/timeout|etimedout|aborted|stalled past timeout/i.test(raw)) {
    return { message, code: "TIMEOUT", stage: hint };
  }
  if (/empty (url|output|result)|could not be signed/i.test(raw)) {
    return { message, code: "EMPTY_RESULT", stage: "mock-persist" };
  }
  if (/enqueue|inngest|queue/i.test(raw)) {
    return { message, code: "QUEUE_FAILED", stage: "queue" };
  }
  if (/persist|object storage|download asset|putobject/i.test(raw)) {
    return { message, code: "MOCK_PERSIST_FAILED", stage: "mock-persist" };
  }
  if (/player|decode|media error/i.test(raw)) {
    return { message, code: "PLAYER_RENDER_FAILED", stage: "player-render" };
  }
  if (/provider returned|replicate|engine unavailable/i.test(raw)) {
    return { message, code: "PROVIDER_FAILED", stage: hint };
  }

  const codeByStage: Record<PipelineStage, GenerationErrorCode> = {
    queue: "QUEUE_FAILED",
    "mock-persist": "MOCK_PERSIST_FAILED",
    "player-render": "PLAYER_RENDER_FAILED",
  };
  return { message, code: codeByStage[hint] || "GENERATION_FAILED", stage: hint };
}

export function createPipelineTrace(generationId?: string) {
  const entries: PipelineLogEntry[] = [];

  const push = (
    stage: PipelineStage,
    status: PipelineStepStatus,
    message: string,
    code?: GenerationErrorCode | string
  ): PipelineLogEntry => {
    const entry: PipelineLogEntry = {
      at: new Date().toISOString(),
      stage,
      status,
      message,
      ...(code ? { code } : {}),
    };
    entries.push(entry);
    const tag = `[Al-Nabi][pipeline][${stage}]`;
    const extra = [generationId || "-", code || "", message].filter(Boolean);
    if (status === "error") console.error(tag, ...extra);
    else if (status === "recovered") console.warn(tag, ...extra);
    else console.info(tag, ...extra);
    return entry;
  };

  return {
    entries,
    ok: (stage: PipelineStage, message: string) =>
      push(stage, "ok", message),
    error: (
      stage: PipelineStage,
      message: string,
      code?: GenerationErrorCode | string
    ) => push(stage, "error", message, code),
    recovered: (
      stage: PipelineStage,
      message: string,
      code?: GenerationErrorCode | string
    ) => push(stage, "recovered", message, code),
  };
}

export function publicGenerationError(data: {
  error?: string | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  code?: string | null;
  message?: string | null;
}): string {
  const msg = String(
    data.error || data.errorMessage || data.message || ""
  ).trim();
  const code = String(data.errorCode || data.code || "").trim();
  if (msg && code && !msg.startsWith(`${code}:`)) return `${code}: ${msg}`;
  if (msg) return msg;
  if (code) return code;
  return "Generation failed. Credits were refunded if charged.";
}

const FAILED_MESSAGE_BY_CODE: Partial<Record<GenerationErrorCode, string>> = {
  NETWORK_RESET: "Network reset while saving media. Credits refunded.",
  MOCK_PERSIST_FAILED: "Could not save the local preview. Credits refunded.",
  EMPTY_RESULT: "Studio returned an empty result. Credits refunded.",
  TIMEOUT: "Generation timed out. Credits refunded.",
  CHARGE_FAILED: "Not enough credits for this generation.",
  PROVIDER_FAILED: "Studio engine unavailable. Credits refunded.",
};

/** FAILED /api/generate bodies must always include these keys (never omitted). */
export function failedGenerateErrorFields(input: {
  publicError?: string | null;
  errorCode?: string | null;
}): {
  error: string;
  errorMessage: string;
  errorCode: string;
} {
  const errorCode = (String(input.errorCode || "GENERATION_FAILED").trim() ||
    "GENERATION_FAILED") as GenerationErrorCode;
  const error = publicGenerationError({
    error:
      input.publicError ||
      FAILED_MESSAGE_BY_CODE[errorCode] ||
      "",
    errorCode,
    code: errorCode,
  });
  return { error, errorMessage: error, errorCode };
}
