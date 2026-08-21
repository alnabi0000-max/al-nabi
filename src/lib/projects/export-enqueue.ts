import {
  assertInngestConfigured,
  inngest,
  isInngestConfigured,
  isProductionRuntime,
  PROJECT_EXPORT_EVENT,
} from "@/lib/inngest/client";

/**
 * Export work uses the same durable worker policy as generation. The caller
 * has already created a persisted job, so queue failure is surfaced and the
 * reservation can be released safely by the route.
 */
export async function enqueueProjectExport(exportId: string): Promise<{
  mode: "inngest" | "local";
}> {
  if (isProductionRuntime()) {
    assertInngestConfigured();
  }

  if (isInngestConfigured()) {
    await inngest.send({
      name: PROJECT_EXPORT_EVENT,
      data: { exportId },
    });
    return { mode: "inngest" };
  }

  try {
    const { after } = await import("next/server");
    after(async () => {
      const { processProjectExport } = await import("@/lib/projects/export-worker");
      await processProjectExport(exportId);
    });
  } catch {
    void import("@/lib/projects/export-worker").then(({ processProjectExport }) =>
      processProjectExport(exportId)
    );
  }
  return { mode: "local" };
}
