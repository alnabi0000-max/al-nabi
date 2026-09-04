function isTransientDbError(err: unknown): boolean {
  const raw =
    err instanceof Error
      ? `${err.message} ${err.name} ${(err as { code?: string }).code || ""}`
      : String(err || "");
  return /econnreset|econnrefused|econnaborted|epipe|socket hang up|can't reach database|p1001|p1017|p2024|server has closed the connection/i.test(
    raw
  );
}

/** One cheap retry for pooled Supabase resets during local mock completes. */
export async function withPrismaRetry<T>(
  fn: () => Promise<T>,
  attempts = 2
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isTransientDbError(err) || i === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 120 * (i + 1)));
    }
  }
  throw last;
}
