import "server-only";
import { getSettings } from "./settings";

/**
 * Customer notification templates. Shops edit these under Settings → Templates;
 * anything left blank falls back to the built-in default. Placeholders:
 *   {customer}  {vehicle}  {shop}  {phone}  {total}  {link}  {date}  {time}  {service}  {invoice}  {amount}
 */
export const TEMPLATE_EVENTS = [
  { key: "estimate_ready", label: "Estimate ready for approval", vars: ["customer", "vehicle", "total", "link", "shop"] },
  { key: "vehicle_ready", label: "Vehicle ready for pickup", vars: ["customer", "vehicle", "shop", "phone"] },
  { key: "waiting_parts", label: "Waiting on parts", vars: ["customer", "vehicle", "shop"] },
  { key: "appointment_booked", label: "Appointment booked", vars: ["customer", "vehicle", "date", "time", "service", "shop"] },
  { key: "appointment_confirmed", label: "Appointment confirmed", vars: ["customer", "vehicle", "date", "time", "shop"] },
  { key: "invoice_ready", label: "Invoice ready", vars: ["customer", "invoice", "total", "shop"] },
  { key: "payment_received", label: "Payment received", vars: ["customer", "amount", "invoice", "shop"] },
] as const;
export type TemplateKey = (typeof TEMPLATE_EVENTS)[number]["key"];

export const DEFAULT_TEMPLATES: Record<TemplateKey, { subject: string; body: string }> = {
  estimate_ready: { subject: "Your estimate is ready", body: "Hi {customer}, your estimate for the {vehicle} ({total}) is ready. Review and approve it here: {link}" },
  vehicle_ready: { subject: "Your vehicle is ready", body: "Hi {customer}, your {vehicle} is ready for pickup at {shop}. Questions? Call {phone}." },
  waiting_parts: { subject: "Waiting on parts", body: "Hi {customer}, we're waiting on parts for your {vehicle}. We'll update you as soon as they arrive. — {shop}" },
  appointment_booked: { subject: "Appointment booked", body: "Hi {customer}, your {vehicle} is booked for {date} at {time} — {service}. See you then! — {shop}" },
  appointment_confirmed: { subject: "Appointment confirmed", body: "Hi {customer}, see you {date} at {time} for your {vehicle}. — {shop}" },
  invoice_ready: { subject: "Invoice {invoice}", body: "Hi {customer}, your invoice {invoice} for {total} is ready to view in your portal. — {shop}" },
  payment_received: { subject: "Payment received — thank you", body: "Hi {customer}, we received your payment of {amount} for invoice {invoice}. Thank you! — {shop}" },
};

export type TemplateVars = Partial<Record<"customer" | "vehicle" | "shop" | "phone" | "total" | "link" | "date" | "time" | "service" | "invoice" | "amount", string>>;

export function fill(text: string, vars: TemplateVars) {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k as keyof TemplateVars] ?? m) as string);
}

/** Resolve the shop's template (or default) and fill in the placeholders. */
export async function renderTemplate(key: TemplateKey, vars: TemplateVars) {
  const s = await getSettings();
  const custom = (s.templates ?? {})[key];
  const base = { ...DEFAULT_TEMPLATES[key], ...(custom?.subject ? { subject: custom.subject } : {}), ...(custom?.body ? { body: custom.body } : {}) };
  const all: TemplateVars = { shop: s.name, phone: s.phone ?? "", ...vars };
  return { subject: fill(base.subject, all), body: fill(base.body, all) };
}
