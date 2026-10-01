export function formatAccountId(id: number | null | undefined): string {
  if (id === null || id === undefined) return "#—";
  return `#${String(id).padStart(3, "0")}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const monthFormatter = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const numberFormatter = new Intl.NumberFormat("en-US");

/** "29 Sep 2026" — rendered in UTC so server and client output always match. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return `${dateTimeFormatter.format(new Date(value))} UTC`;
}

export function formatMonth(yyyyMm: string): string {
  return monthFormatter.format(new Date(`${yyyyMm}-01T00:00:00Z`));
}

export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return currencyFormatter.format(Number(value));
}

export function formatNumber(value: number | null | undefined): string {
  return numberFormatter.format(Number(value ?? 0));
}

export function initials(name: string | null | undefined, fallback = "?"): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Stable avatar gradient per user id/name. */
export function avatarGradient(seed: string | null | undefined): string {
  const gradients = [
    "from-sky-400 to-blue-600",
    "from-yellow-300 to-amber-500",
    "from-rose-400 to-red-600",
    "from-violet-400 to-purple-600",
    "from-emerald-400 to-green-600",
    "from-orange-300 to-orange-600",
    "from-cyan-300 to-teal-600",
    "from-fuchsia-400 to-pink-600",
  ];
  let hash = 0;
  for (const char of seed ?? "") hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return gradients[Math.abs(hash) % gradients.length];
}
