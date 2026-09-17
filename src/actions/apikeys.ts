"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { API_SCOPES, hashKey, newApiKey, newWebhookSecret } from "@/lib/api";
import { WEBHOOK_EVENTS, deliverOne } from "@/lib/webhooks";

const back = (msg: string, err = false, extra = ""): never => redirect(`/settings?tab=api&${err ? "error" : "ok"}=${encodeURIComponent(msg)}${extra}`);

export async function createApiKey(formData: FormData) {
  const user = await requireStaff(MANAGER_ROLES);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back("Give the key a name (e.g. QuickBooks sync)", true);
  const scopes = formData.getAll("scopes").map(String).filter((s) => (API_SCOPES as readonly string[]).includes(s));
  if (!scopes.length) back("Pick at least one scope", true);
  const expiresRaw = String(formData.get("expiresAt") ?? "");
  const key = newApiKey();
  const row = await db.apiKey.create({ data: { name, scopes, keyHash: hashKey(key), keyPrefix: key.slice(0, 12), expiresAt: expiresRaw ? new Date(expiresRaw) : null, createdBy: user.name } });
  await db.auditLog.create({ data: { userId: user.id, action: "create", entity: "ApiKey", entityId: row.id, detail: name } });
  revalidatePath("/settings");
  back(`API key "${name}" created — copy it now, it is only shown once.`, false, `&newKey=${encodeURIComponent(key)}&newId=${row.id}`);
}

export async function toggleApiKey(id: string) {
  await requireStaff(MANAGER_ROLES);
  const row = await db.apiKey.findUniqueOrThrow({ where: { id } });
  await db.apiKey.update({ where: { id }, data: { enabled: !row.enabled } });
  revalidatePath("/settings");
  back(`${row.name} ${row.enabled ? "disabled" : "enabled"}`);
}

export async function rotateApiKey(id: string) {
  const user = await requireStaff(MANAGER_ROLES);
  const key = newApiKey();
  const row = await db.apiKey.update({ where: { id }, data: { keyHash: hashKey(key), keyPrefix: key.slice(0, 12), enabled: true } });
  await db.auditLog.create({ data: { userId: user.id, action: "rotate", entity: "ApiKey", entityId: id, detail: row.name } });
  back(`${row.name} rotated — the old key stopped working.`, false, `&newKey=${encodeURIComponent(key)}&newId=${id}`);
}

export async function deleteApiKey(id: string) {
  const user = await requireStaff(MANAGER_ROLES);
  const row = await db.apiKey.delete({ where: { id } });
  await db.auditLog.create({ data: { userId: user.id, action: "delete", entity: "ApiKey", entityId: id, detail: row.name } });
  revalidatePath("/settings");
  back(`${row.name} revoked`);
}

// ───────── Webhooks ─────────

export async function createWebhook(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  if (!name || !/^https?:\/\//i.test(url)) back("Name and an http(s) URL are required", true);
  const events = formData.getAll("events").map(String).filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
  const secret = newWebhookSecret();
  const row = await db.webhookEndpoint.create({ data: { name, url, secret, events } });
  revalidatePath("/settings");
  back(`Webhook "${name}" added — copy the signing secret now.`, false, `&newSecret=${encodeURIComponent(secret)}&newHook=${row.id}`);
}

export async function toggleWebhook(id: string) {
  await requireStaff(MANAGER_ROLES);
  const row = await db.webhookEndpoint.findUniqueOrThrow({ where: { id } });
  await db.webhookEndpoint.update({ where: { id }, data: { enabled: !row.enabled, failures: 0 } });
  revalidatePath("/settings");
  back(`${row.name} ${row.enabled ? "paused" : "enabled"}`);
}

export async function deleteWebhook(id: string) {
  await requireStaff(MANAGER_ROLES);
  const row = await db.webhookEndpoint.delete({ where: { id } });
  revalidatePath("/settings");
  back(`${row.name} removed`);
}

export async function testWebhook(id: string) {
  const user = await requireStaff(MANAGER_ROLES);
  const row = await db.webhookEndpoint.findUniqueOrThrow({ where: { id } });
  const result = await deliverOne(row, "ping", { event: "ping", at: new Date().toISOString(), data: { message: `Test from NexDrive by ${user.name}` } }, 3);
  revalidatePath("/settings");
  if (result.ok) back(`Ping delivered to ${row.name} (HTTP ${result.status})`);
  back(`Ping to ${row.name} failed: ${result.error ?? "unknown error"}`, true);
}
