/**
 * Yagona brauzer xotirasi kalitlari (100% standart).
 * DB: User.coins | User.alnabiyKey
 * LS: alnabiy_coins | alnabiy_key
 */
export const STORAGE = {
  coins: "alnabiy_coins",
  key: "alnabiy_key",
  status: "alnabiy_status",
  attempts: "alnabiy_security_attempts",
  locale: "alnabiy_locale",
  queue: "alnabiy_ai_queue",
  history: "alnabiy_generation_history",
  session: "alnabiy_session",
} as const;

export const WATERMARK_TEXT = "Al-Nabi Preview" as const;
