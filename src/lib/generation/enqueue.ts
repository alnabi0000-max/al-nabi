import {
  assertInngestConfigured,
  GENERATION_EVENT,
  inngest,
  isInngestConfigured,
  isProductionRuntime,
} from "@/lib/inngest/client";

/**
 * Inngest ga yuborish. Development only falls back to Next.js `after()`;
 * production must dispatch to Inngest so work is not lost with the request.
 * processGenerationJob dinamik import — webpack/module crash dan himoya.
 */
export async function enqueueGeneration(generationId: string): Promise<{
  mode: "inngest" | "local";
}> {
  if (isProductionRuntime()) {
    assertInngestConfigured();
  }

  if (isInngestConfigured()) {
    try {
      await inngest.send({
        name: GENERATION_EVENT,
        data: { generationId },
      });
      return { mode: "inngest" };
    } catch (e) {
      if (isProductionRuntime()) {
        throw new Error(
          "Inngest dispatch failed; generation was not started. Please retry."
        );
      }
      console.warn("[Alnabiy] Inngest dispatch failed, using local worker", e);
    }
  }

  try {
    const { after } = await import("next/server");
    after(async () => {
      try {
        const { processGenerationJob } = await import(
          "@/lib/generation/process"
        );
        await processGenerationJob(generationId);
      } catch (e) {
        console.warn("[Alnabiy] local generation worker failed", e);
        const { failAndRefundGeneration } = await import(
          "@/lib/generation/fail-and-refund"
        );
        await failAndRefundGeneration({
          generationId,
          error: e,
          area: "enqueue-after",
        });
      }
    });
  } catch (e) {
    /* after() mavjud emas yoki buzilgan — fire-and-forget */
    console.warn("[Alnabiy] after() unavailable, using void worker", e);
    void (async () => {
      try {
        const { processGenerationJob } = await import(
          "@/lib/generation/process"
        );
        await processGenerationJob(generationId);
      } catch (err) {
        console.warn("[Alnabiy] local generation worker failed", err);
        const { failAndRefundGeneration } = await import(
          "@/lib/generation/fail-and-refund"
        );
        await failAndRefundGeneration({
          generationId,
          error: err,
          area: "enqueue-void",
        });
      }
    })();
  }

  return { mode: "local" };
}
