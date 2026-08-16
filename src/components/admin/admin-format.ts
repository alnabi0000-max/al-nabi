export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatNc(n: number): string {
  return `${n.toLocaleString("en-US")} NC`;
}

export function formatAdminWhen(iso: string, locale: string): string {
  const date = new Date(iso);
  return date.toLocaleString(
    locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}
