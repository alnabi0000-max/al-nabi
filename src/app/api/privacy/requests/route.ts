import { NextRequest } from "next/server";
import { z } from "zod";
import { PrivacyRequestType } from "@prisma/client";
import { apiError, apiJson, formatRouteError } from "@/lib/api/json-response";
import { ensureRequestLedgerUser } from "@/lib/auth/ensure-request-user";
import {
  createDataExport,
  createErasureRequest,
  ErasureConfirmationError,
  listPrivacyRequests,
  processErasureRequest,
} from "@/lib/privacy/requests";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(PrivacyRequestType.DATA_EXPORT),
  }),
  z.object({
    type: z.literal(PrivacyRequestType.ACCOUNT_ERASURE),
    confirmation: z.string().min(1).max(100),
  }),
]);

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
  try {
    return apiJson({
      requests: await listPrivacyRequests(authenticated.user.id),
    });
  } catch {
    return apiError("Privacy request status is temporarily unavailable.", {
      status: 503,
      code: "PRIVACY_UNAVAILABLE",
    });
  }
}

/**
 * Data exports are returned only to the authenticated request that created
 * them. Erasure creates a durable, confirmed request before work starts; the
 * response always reflects held, failed, or completed work honestly.
 */
export async function POST(req: NextRequest) {
  try {
    const authenticated = await currentUser(req);
    if (!authenticated) {
      return apiError("Sign in is required.", {
        status: 401,
        code: "UNAUTHORIZED",
      });
    }
    const body = schema.parse(await req.json());

    if (body.type === PrivacyRequestType.DATA_EXPORT) {
      const result = await createDataExport({ userId: authenticated.user.id });
      return apiJson(
        {
          request: result.request,
          export: result.exportData,
        },
        {
          headers: {
            "Content-Disposition":
              'attachment; filename="al-nabi-account-export.json"',
          },
        }
      );
    }

    const requested = await createErasureRequest({
      userId: authenticated.user.id,
      confirmation: body.confirmation,
    });
    const request =
      requested.status === "REQUESTED"
        ? await processErasureRequest({
            requestId: requested.id,
            userId: authenticated.user.id,
          })
        : requested;
    return apiJson({ request }, { status: 202 });
  } catch (error) {
    if (error instanceof ErasureConfirmationError) {
      return apiError(
        'To protect your account, type "ERASE MY ACCOUNT" to confirm irreversible erasure.',
        { status: 400, code: "ERASURE_CONFIRMATION_REQUIRED" }
      );
    }
    const formatted = formatRouteError(error);
    return apiError(formatted.message, {
      status: formatted.status,
      code: formatted.code,
    });
  }
}
