import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "alnabiy",
  name: "Alnabiy AI",
});

export const GENERATION_EVENT = "alnabiy/generation.requested" as const;

export const isProductionRuntime = () => process.env.NODE_ENV === "production";

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export type GenerationRequestedEvent = {
  name: typeof GENERATION_EVENT;
  data: {
    generationId: string;
  };
};

export function isInngestConfigured(): boolean {
  const eventKey = configured(process.env.INNGEST_EVENT_KEY);
  const signingKey = configured(process.env.INNGEST_SIGNING_KEY);

  /*
   * A production sender without a signing key can enqueue work that no
   * registered worker will accept. Require both credentials up front instead
   * of creating generations that can only be reclaimed by the stale-job path.
   */
  if (isProductionRuntime()) {
    return eventKey && signingKey;
  }

  return eventKey || process.env.INNGEST_DEV === "1";
}

export class InngestConfigurationError extends Error {
  constructor() {
    super(
      "Inngest is required for production generations. Set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY."
    );
    this.name = "InngestConfigurationError";
  }
}

export function assertInngestConfigured(): void {
  if (!isInngestConfigured()) {
    throw new InngestConfigurationError();
  }
}
