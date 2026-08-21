import { inngest, PROJECT_EXPORT_EVENT } from "@/lib/inngest/client";
import { processProjectExport } from "@/lib/projects/export-worker";

/**
 * Durable timeline-export worker. It only receives the persisted export ID;
 * private media keys and signed source URLs are resolved server-side.
 */
export const processProjectExportFn = inngest.createFunction(
  {
    id: "process-project-export",
    name: "Process Alnabiy Project Export",
    retries: 2,
    triggers: [{ event: PROJECT_EXPORT_EVENT }],
  },
  async ({ event, step }) => {
    const exportId = String((event.data as { exportId?: string })?.exportId || "");
    if (!exportId) throw new Error("exportId missing from event");
    return step.run("compose-and-store", () => processProjectExport(exportId));
  }
);
