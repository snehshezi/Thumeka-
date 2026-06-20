export function formatMoney(value: number | string | null | undefined) {
  const amount =
    typeof value === "string" ? Number.parseFloat(value) : Number(value ?? 0);

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR"
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Time-of-day greeting in South African (Africa/Johannesburg) local time.
 *
 * Morning  05:00 – 11:59
 * Afternoon 12:00 – 16:59
 * Evening  17:00 – 04:59
 */
export function getGreeting(date: Date = new Date()): string {
  const hourString = date.toLocaleString("en-ZA", {
    hour: "numeric",
    hour12: false,
    timeZone: "Africa/Johannesburg"
  });
  const hour = Number.parseInt(hourString, 10);

  if (Number.isNaN(hour)) {
    return "Welcome back";
  }

  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Compact "time elapsed" label for queue ages and audit timestamps.
 * No date-fns dep — Date arithmetic only.
 *
 *   < 1 min  → "just now"
 *   < 60 min → "32m"
 *   < 24 h   → "1h 04m"
 *   ≥ 24 h   → "2d 3h"
 */
export function formatWaitingSince(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";

  const diffMs = Math.max(0, now.getTime() - then);
  const totalMinutes = Math.floor(diffMs / 60_000);

  if (totalMinutes < 1) return "just now";
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes - totalHours * 60;

  if (totalHours < 24) {
    return `${totalHours}h ${String(minutes).padStart(2, "0")}m`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours - days * 24;
  return `${days}d ${hours}h`;
}
