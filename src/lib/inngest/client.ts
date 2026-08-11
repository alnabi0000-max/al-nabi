import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "alnabiy",
  name: "Alnabiy AI",
});

export const GENERATION_EVENT = "alnabiy/generation.requested" as const;

export type GenerationRequestedEvent = {
  name: typeof GENERATION_EVENT;
  data: {
    generationId: string;
  };
};

export function isInngestConfigured(): boolean {
  return Boolean(
    process.env.INNGEST_EVENT_KEY?.trim() ||
      process.env.INNGEST_DEV === "1" ||
      process.env.NODE_ENV === "development"
  );
}
