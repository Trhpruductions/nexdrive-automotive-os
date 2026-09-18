import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Twilio signs webhooks with base64(HMAC-SHA1(url + sorted POST params, auth token)). */
export function validTwilioSignature(url: string, params: Record<string, string>, signature: string | null, authToken: string) {
  if (!signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Last ten digits of a phone number, ignoring a leading country code 1. */
export const phoneTail = (s: string) => s.replace(/\D/g, "").replace(/^1(\d{10})$/, "$1").slice(-10);
