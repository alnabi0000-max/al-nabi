import { serve } from "inngest/next";
import {
  inngest,
  isInngestConfigured,
  isProductionRuntime,
} from "@/lib/inngest/client";
import { inngestFunctions } from "@/inngest/functions";

const handlers = serve({
  client: inngest,
  functions: inngestFunctions,
});

function unavailableResponse(): Response | null {
  if (isProductionRuntime() && !isInngestConfigured()) {
    return Response.json(
      {
        ok: false,
        code: "INNGEST_UNAVAILABLE",
        error:
          "Inngest production credentials are required before workers can accept requests.",
      },
      { status: 503 }
    );
  }
  return null;
}

export async function GET(...args: Parameters<typeof handlers.GET>) {
  return unavailableResponse() || handlers.GET(...args);
}

export async function POST(...args: Parameters<typeof handlers.POST>) {
  return unavailableResponse() || handlers.POST(...args);
}

export async function PUT(...args: Parameters<typeof handlers.PUT>) {
  return unavailableResponse() || handlers.PUT(...args);
}
