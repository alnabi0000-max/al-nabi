import { NextRequest } from "next/server";
import { apiError, apiJson } from "@/lib/api/json-response";
import { ensureRequestLedgerUser } from "@/lib/auth/ensure-request-user";
import { getCurrentEntitlements } from "@/lib/billing/entitlements";
import { getConsentStatus } from "@/lib/trust/consent";
import { listPrivacyRequests } from "@/lib/privacy/requests";
import { SAFETY_POLICY_VERSION } from "@/lib/trust/safety";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Compact account-status surface. It excludes prompt text, media URLs, object
 * keys, billing provider payloads, and policy-internal categories.
 */
export async function GET(req: NextRequest) {
  const authenticated = await ensureRequestLedgerUser({
    alnabiyKey: req.headers.get("x-alnabiy-key"),
    allowGuest: false,
    request: req,
  });
  if (!authenticated) {
    return apiError("Sign in is required.", {
      status: 401,
      code: "UNAUTHORIZED",
    });
  }

  try {
    const [consents, entitlements, privacyRequests, recentSafety] = await Promise.all([
      getConsentStatus(authenticated.user.id),
      getCurrentEntitlements(authenticated.user.id),
      listPrivacyRequests(authenticated.user.id),
      prisma.safetyAudit.findMany({
        where: { userId: authenticated.user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          surface: true,
          outcome: true,
          createdAt: true,
        },
      }),
    ]);
    return apiJson({
      consents,
      entitlements,
      privacyRequests,
      safety: {
        policyVersion: SAFETY_POLICY_VERSION,
        message:
          "Text safety screening is automated where configured. Reference media may require review before processing.",
        recentOutcomes: recentSafety.map((item) => ({
          surface: item.surface,
          outcome: item.outcome,
          createdAt: item.createdAt.toISOString(),
        })),
      },
    });
  } catch {
    return apiError("Account trust status is temporarily unavailable.", {
      status: 503,
      code: "TRUST_UNAVAILABLE",
    });
  }
}
