import Stripe from "stripe";
import { isPlaceholderEnvValue } from "@/lib/env";

export function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  if (!key || isPlaceholderEnvValue(key)) return "";
  return key;
}

export function getStripeWebhookSecret(): string {
  const key = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
  if (!key || isPlaceholderEnvValue(key)) return "";
  return key;
}

export function createStripeClient(secret = getStripeSecretKey()): Stripe | null {
  if (!secret) return null;
  return new Stripe(secret, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2024-11-20.acacia" as any,
  });
}
