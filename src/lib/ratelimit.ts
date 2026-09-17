import "server-only";
import { headers } from "next/headers";

/**
 * Small in-memory rate limiter for login, password reset and public booking.
 * Per-process (fine for a single container); swap for Redis if you scale out.
 */
type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

/** Returns seconds to wait when over the limit, or 0 when allowed (and records the hit). */
export function rateLimit(key: string, limit: number, windowSec: number): number {
  const now = Date.now();
  const since = now - windowSec * 1000;
  let b = buckets.get(key);
  if (!b) {
    if (buckets.size >= MAX_KEYS) buckets.clear();
    b = { hits: [] };
    buckets.set(key, b);
  }
  b.hits = b.hits.filter((t) => t > since);
  if (b.hits.length >= limit) return Math.ceil((b.hits[0] + windowSec * 1000 - now) / 1000);
  b.hits.push(now);
  return 0;
}

/** Forget a key (e.g. after a successful login). */
export function rateReset(key: string) {
  buckets.delete(key);
}
