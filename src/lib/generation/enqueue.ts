import { inngest, GENERATION_EVENT } from "@/lib/inngest/client";

/**
 * Inngest ga yuborish; kalit bo‘lmasa Next.js `after()` da lokal ishlash.
 * processGenerationJob dinamik import — webpack/module crash dan himoya.
 */
export async function enqueueGeneration(generationId: string): Promise<{
  mode: "inngest" | "local";
}> {
  const hasKey = Boolean(process.env.INNGEST_EVENT_KEY?.trim());

  if (hasKey) {
    try {
      await inngest.send({
        name: GENERATION_EVENT,
        data: { generationId },
      });
      return { mode: "inngest" };
    } catch (e) {
      console.warn("[Alnabiy] inngest send failed, falling back to local", e);
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
