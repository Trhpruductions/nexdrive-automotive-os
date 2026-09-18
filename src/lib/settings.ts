import "server-only";
import { cache } from "react";
import { db, currentShopIdOrNull } from "./db";
import { DEFAULT_VERTICAL, termsFor, type Terms } from "./verticals";
import { ALL_MODULE_KEYS, type ModuleKey } from "./constants";

export type ShopSettings = {
  id: string;
  shopId: string;
  name: string;
  tagline: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  website: string | null;
  taxRate: number;
  laborRate: number;
  shopFeeRate: number;
  openTime: string;
  closeTime: string;
  invoiceFooter: string | null;
  logoUrl: string | null;
  accentColor: string;
  currency: string;
  timezone: string;
  modules: ModuleKey[];
  approvalMessage: string | null;
  portalWelcome: string | null;
  templates: Record<string, { subject?: string; body?: string }> | null;
  onlineBooking: boolean;
  bookingNotes: string | null;
  dailyDigest: boolean;
  digestHour: number;
  smsNumber: string | null;
  vertical: string;
  shifts: unknown;
  /** effective vocabulary for the serviced asset (business type + overrides) */
  terms: Terms;
  /** the shop has entered its own Stripe keys (secrets never leave the server) */
  stripeConfigured: boolean;
};

/** Shop settings row (created with defaults on first read). Memoised per request. */
export const PLATFORM_DEFAULTS: ShopSettings = {
  id: "", shopId: "", name: "NexDrive Automotive OS", tagline: "Complete automotive business management software", phone: null, email: null, address: null, city: null, state: null, zip: null, website: null,
  taxRate: 0, laborRate: 0, shopFeeRate: 0, openTime: "08:00", closeTime: "18:00", invoiceFooter: null, logoUrl: null, accentColor: "#2f7cf6", currency: "USD", timezone: "America/New_York",
  modules: [...ALL_MODULE_KEYS], approvalMessage: null, portalWelcome: null, templates: null, onlineBooking: false, bookingNotes: null, dailyDigest: false, digestHour: 18, smsNumber: null, vertical: DEFAULT_VERTICAL, shifts: null, terms: termsFor(DEFAULT_VERTICAL), stripeConfigured: false,
};

/** Shop settings, memoised per request *per shop* (the root layout may run with no shop context). */
export async function getSettings(): Promise<ShopSettings> {
  const shopId = await currentShopIdOrNull();
  if (!shopId) return PLATFORM_DEFAULTS;
  return loadSettings(shopId);
}

const loadSettings = cache(async (shopId: string): Promise<ShopSettings> => {
  let row = await db.shopSettings.findFirst({ where: { shopId } });
  if (!row) {
    // a stale session can point at a shop that no longer exists (reseed, deleted shop): behave like signed out
    const exists = await db.shop.findUnique({ where: { id: shopId }, select: { id: true } });
    if (!exists) return PLATFORM_DEFAULTS;
    row = await db.shopSettings.create({ data: { shopId } });
  }
  const { stripeSecretKey, stripeWebhookSecret, lastDigestAt: _lastDigestAt, ...safe } = row;
  void _lastDigestAt;
  return {
    ...safe,
    stripeConfigured: Boolean(stripeSecretKey && stripeWebhookSecret),
    terms: termsFor(row.vertical, (row.terms as Partial<Terms> | null) ?? null),
    templates: (row.templates as Record<string, { subject?: string; body?: string }> | null) ?? null,
    taxRate: Number(row.taxRate),
    laborRate: Number(row.laborRate),
    shopFeeRate: Number(row.shopFeeRate),
    modules: row.modules.filter((m): m is ModuleKey => (ALL_MODULE_KEYS as string[]).includes(m)),
  };
});

export function moduleEnabled(settings: ShopSettings, key: ModuleKey) {
  return settings.modules.includes(key);
}

export function shopAddress(s: ShopSettings) {
  const line2 = [s.city, s.state].filter(Boolean).join(", ") + (s.zip ? ` ${s.zip}` : "");
  return [s.address, line2.trim()].filter(Boolean);
}

/** Hex accent → derived tokens for the CSS variables. */
export function accentVars(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const clean = m ? `#${m[1]}` : "#2f7cf6";
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  const darker = `#${[r, g, b].map((v) => Math.max(0, Math.round(v * 0.86)).toString(16).padStart(2, "0")).join("")}`;
  return {
    "--accent": clean,
    "--accent-strong": darker,
    "--accent-soft": `rgba(${r}, ${g}, ${b}, 0.14)`,
  } as React.CSSProperties;
}
