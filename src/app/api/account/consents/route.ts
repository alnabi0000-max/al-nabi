import { NextRequest } from "next/server";
import { z } from "zod";
import { ConsentAction, ConsentDocument } from "@prisma/client";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { ensureRequestLedgerUser } from "@/lib/auth/ensure-request-user";
import {
  ConsentWithdrawalNotAvailableError,
  getConsentStatus,
  recordConsentAction,
} from "@/lib/trust/consent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  document: z.nativeEnum(ConsentDocument),
  action: z.nativeEnum(ConsentAction),
});

async function currentUser(req: NextRequest) {
  return ensureRequestLedgerUser({
    alnabiyKey: req.headers.get("x-alnabiy-key"),
    allowGuest: false,
    request: req,
  });
}

export async function GET(req: NextRequest) {
  const authenticated = await currentUser(req);
  if (!authenticated) {
    return apiError("Sign in is required.", {
      status: 401,
      code: "UNAUTHORIZED",
    });
  }
  const consents = await getConsentStatus(authenticated.user.id);
  return apiJson({ consents });
}

/**
 * Add a consent action record. The API never alters a historic acceptance row.
 */
export async function PUT(req: NextRequest) {
  try {
    const authenticated = await currentUser(req);
    if (!authenticated) {
      return apiError("Sign in is required.", {
        status: 401,
        code: "UNAUTHORIZED",
      });
    }
    const body = schema.parse(await req.json());
    const consent = await recordConsentAction({
      userId: authenticated.user.id,
      document: body.document,
      action: body.action,
    });
    return apiJson({ consent });
  } catch (error) {
    if (error instanceof ConsentWithdrawalNotAvailableError) {
      return apiError(
        "This required legal record is retained. You can withdraw optional processing choices instead.",
        { status: 409, code: "CONSENT_WITHDRAWAL_NOT_AVAILABLE" }
      );
    }
    const formatted = formatRouteError(error);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
