import { inngest, GENERATION_EVENT } from "@/lib/inngest/client";
import { processGenerationJob } from "@/lib/generation/process";
import { prisma } from "@/lib/prisma";

/**
 * Inngest v4 worker — background AI generation + R2 persist + ledger rollback.
 */
export const processGenerationFn = inngest.createFunction(
  {
    id: "process-generation",
    name: "Process Alnabiy Generation",
    retries: 2,
    triggers: [{ event: GENERATION_EVENT }],
  },
  async ({ event, step }) => {
    const generationId = String(
      (event.data as { generationId?: string })?.generationId || ""
    );
    if (!generationId) {
      throw new Error("generationId missing from event");
    }

    await step.run("mark-event", async () => {
      const row = await prisma.generation.findUnique({
        where: { id: generationId },
        select: { status: true },
      });
      if (!row || row.status === "COMPLETED" || row.status === "FAILED") {
        return;
      }
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          inngestEventId: event.id || null,
        },
      });
    });

    const result = await step.run("render-and-store", async () =>
      processGenerationJob(generationId)
    );

    /* Soft failure already refunded inside processGenerationJob — do not throw (avoids double-refund retries). */
    return result;
  }
);
