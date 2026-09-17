import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from "date-fns";

export function money(value: number | string | { toString(): string } | null | undefined, currency = "USD") {
  const n = value == null ? 0 : Number(value.toString());
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

export function num(value: number | string | { toString(): string } | null | undefined, digits = 0) {
  const n = value == null ? 0 : Number(value.toString());
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

export function pct(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "MMM d, yyyy");
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "MMM d, yyyy h:mm a");
}

export function fmtTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "h:mm a");
}

export function fmtRelative(d: Date | string | null | undefined) {
  if (!d) return "—";
  return `${formatDistanceToNowStrict(new Date(d))} ago`;
}

export function fmtDay(d: Date | string) {
  const date = new Date(d);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEE, MMM d");
}

/** value for <input type="datetime-local"> */
export function toLocalInput(d: Date | string | null | undefined) {
  if (!d) return "";
  return format(new Date(d), "yyyy-MM-dd'T'HH:mm");
}

export function toDateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  return format(new Date(d), "yyyy-MM-dd");
}

export function vehicleName(v: { year: number; make: string; model: string; trim?: string | null }) {
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
}

export function customerName(c: { firstName: string; lastName: string; company?: string | null }) {
  const n = `${c.firstName} ${c.lastName}`.trim();
  return c.company ? `${n} · ${c.company}` : n;
}

export function woNumber(n: number) {
  return `WO-${String(n).padStart(5, "0")}`;
}

export function invNumber(n: number) {
  return `INV-${String(n).padStart(5, "0")}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
