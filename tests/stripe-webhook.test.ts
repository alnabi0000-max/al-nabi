import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleStripeWebhook } from "@/lib/stripe/webhook-handler";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Stripe webhook", () => {
  it("fails closed before parsing a webhook when Stripe is not configured", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

    const response = await handleStripeWebhook(
      new NextRequest("https://example.test/api/webhooks/stripe", {
        body: "{}",
        method: "POST",
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Stripe not configured",
    });
    expect(response.status).toBe(503);
  });
});
