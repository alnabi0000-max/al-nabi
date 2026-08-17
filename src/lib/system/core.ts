/**
 * Al-Nabi core platform architecture — single source of truth.
 * White-label: never expose upstream vendor brands to end users.
 */

import {
  ARCHIVE_REDOWNLOAD_FEE_NC,
  COIN_NAME,
} from "@/lib/credits";
import { isPersistentObjectStorageConfigured } from "@/lib/storage/object-storage";

export const PLATFORM = {
  brand: "Al-Nabi",
  engine: "Al-Nabi Native Engine",
  audioEngine: "Al-Nabi Audio Engine",
  currency: COIN_NAME,
  currencyFull: "Nabi Credits",
  archiveRedownloadFeeNc: ARCHIVE_REDOWNLOAD_FEE_NC,
} as const;

export type CoreHealth = {
  brand: string;
  currency: string;
  engine: string;
  archiveFeeNc: number;
  openRouter: boolean;
  videoApi: boolean;
  telegram: boolean;
  adminSecret: boolean;
  cronSecret: boolean;
  objectStorage: boolean;
  ready: boolean;
};

/** Server-side readiness probe for Admin Dashboard. */
export function probeCoreHealth(): CoreHealth {
  const openRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const videoApi = Boolean(
    process.env.REPLICATE_API_KEY?.trim() ||
      process.env.REPLICATE_API_TOKEN?.trim()
  );
  const telegram = Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() &&
      process.env.TELEGRAM_ADMIN_CHAT_ID?.trim()
  );
  const adminSecret = Boolean(process.env.ADMIN_API_SECRET?.trim());
  const cronSecret = Boolean(
    process.env.CRON_SECRET?.trim() || process.env.ADMIN_API_SECRET?.trim()
  );
  const objectStorage = isPersistentObjectStorageConfigured();

  return {
    brand: PLATFORM.brand,
    currency: PLATFORM.currency,
    engine: PLATFORM.engine,
    archiveFeeNc: PLATFORM.archiveRedownloadFeeNc,
    openRouter,
    videoApi,
    telegram,
    adminSecret,
    cronSecret,
    objectStorage,
    ready: openRouter && videoApi,
  };
}
