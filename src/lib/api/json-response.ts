import { NextResponse } from "next/server";
import { ZodError } from "zod";

type JsonInit = {
  status?: number;
  headers?: HeadersInit;
};

/** Har doim application/json — HTML error page o‘rniga */
export function apiJson<T extends Record<string, unknown>>(
  body: T,
  init?: JsonInit
): NextResponse {
  const status = init?.status ?? 200;
  const okFlag =
    typeof body.ok === "boolean"
      ? body.ok
      : typeof body.success === "boolean"
        ? body.success
        : status >= 200 && status < 300;
  const successFlag =
    typeof body.success === "boolean" ? body.success : okFlag;

  return NextResponse.json(
    {
      ...body,
      success: successFlag,
      ok: okFlag,
    },
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...(init?.headers || {}),
      },
    }
  );
}

export function apiError(
  error: string,
  opts?: {
    status?: number;
    code?: string;
    extra?: Record<string, unknown>;
  }
): NextResponse {
  return apiJson(
    {
      success: false,
      ok: false,
      error,
      code: opts?.code || "ERROR",
      ...(opts?.extra || {}),
    },
    { status: opts?.status ?? 500 }
  );
}

export function formatRouteError(e: unknown): {
  message: string;
  code: string;
  status: number;
  details?: unknown;
} {
  if (e instanceof ZodError) {
    const first = e.issues[0];
    const path = first?.path?.length ? first.path.join(".") : "body";
    return {
      message: first?.message
        ? `${path}: ${first.message}`
        : "Invalid request body",
      code: "VALIDATION_ERROR",
      status: 400,
      details: e.issues,
    };
  }
  if (e instanceof SyntaxError) {
    return {
      message: "Invalid JSON body",
      code: "INVALID_JSON",
      status: 400,
    };
  }
  const message = e instanceof Error ? e.message : "Request failed";
  if (
    message.includes("Can't reach database") ||
    message.includes("P1001") ||
    /does not exist/i.test(message)
  ) {
    return {
      message:
        "Database unavailable. Configure DATABASE_URL and run prisma db push.",
      code: "DB_UNAVAILABLE",
      status: 503,
    };
  }
  return {
    message: message.slice(0, 500),
    code: "INTERNAL_ERROR",
    status: 500,
  };
}
