import { cron } from "inngest";
import { inngest } from "@/lib/inngest/client";
import { runModelWatchCycle } from "@/lib/admin/model-watcher";

/**
 * Every 12h: scan video model endpoints + notify Admin / Telegram.
 */
export const modelWatchFn = inngest.createFunction(
  {
    id: "alnabiy-model-watch",
    name: "Al-Nabi Model Watcher",
    retries: 1,
    triggers: [cron("0 */12 * * *"), { event: "alnabiy/admin.model-watch" }],
  },
  async ({ step }) => {
    const result = await step.run("scan-models", async () =>
      runModelWatchCycle()
    );
    return result;
  }
);
