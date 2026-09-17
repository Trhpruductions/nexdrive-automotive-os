import { handler, json } from "@/lib/api";
import { getSettings } from "@/lib/settings";

export const GET = handler("read", async (_req, { key }) => {
  const s = await getSettings();
  return json({ key: { id: key.id, name: key.name, scopes: key.scopes }, shop: { name: s.name, tagline: s.tagline, phone: s.phone, email: s.email, timezone: s.timezone, currency: s.currency, taxRate: s.taxRate, laborRate: s.laborRate, openTime: s.openTime, closeTime: s.closeTime } });
});
