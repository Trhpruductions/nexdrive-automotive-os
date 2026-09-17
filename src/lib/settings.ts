import "server-only";
import { cache } from "react";
import { db } from "./db";
import { ALL_MODULE_KEYS, type ModuleKey } from "./constants";

export type ShopSettings = {
  id: number;
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
};

/** Shop settings row (created with defaults on first read). Memoised per request. */
export const getSettings = cache(async (): Promise<ShopSettings> => {
  const row =
    (await db.shopSettings.findUnique({ where: { id: 1 } })) ??
    (await db.shopSettings.create({ data: { id: 1 } }));
  return {
    ...row,
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
