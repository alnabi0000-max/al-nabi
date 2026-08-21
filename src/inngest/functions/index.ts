import { processGenerationFn } from "./process-generation";
import { modelWatchFn } from "./model-watch";
import { processProjectExportFn } from "./process-project-export";

export const inngestFunctions = [
  processGenerationFn,
  processProjectExportFn,
  modelWatchFn,
];
