"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { db, currentShopId } from "@/lib/db";
import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { hashKey, resyncIntegrations, runIntegrationOnce } from "@/lib/integrations/runtime";
import { applyEvents } from "@/lib/integrations/events";
import type { IntegrationType, MachineStatus } from "@/generated/prisma/enums";

const back = (msg: string, err = false, extra = ""): never => redirect(`/settings?tab=integrations&${err ? "error" : "ok"}=${encodeURIComponent(msg)}${extra}`);
const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function parseMapping(raw: unknown) {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return undefined;
  try {
    const m = JSON.parse(s);
    if (!m || typeof m !== "object") throw new Error();
    return m;
  } catch {
    throw new Error("Mapping must be valid JSON");
  }
}

export async function createIntegration(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "WEBHOOK") as IntegrationType;
  if (!name) back("Name is required", true);
  let config: Record<string, unknown> = {};
  try {
    const mapping = parseMapping(formData.get("mapping"));
    if (type === "MQTT") {
      config = { broker: opt(formData.get("broker")), username: opt(formData.get("username")), password: opt(formData.get("password")), topics: String(formData.get("topics") ?? "").split(/[\n,]/).map((t) => t.trim()).filter(Boolean), mapping };
      if (!config.broker) back("Broker URL is required (e.g. mqtt://192.168.1.50:1883)", true);
    } else if (type === "REST_POLL") {
      let headers: Record<string, string> | undefined;
      const h = String(formData.get("headers") ?? "").trim();
      if (h) {
        try {
          headers = JSON.parse(h);
        } catch {
          back("Headers must be a JSON object", true);
        }
      }
      config = { url: opt(formData.get("url")), method: opt(formData.get("method")) ?? "GET", headers, intervalSec: Number(formData.get("intervalSec")) || 60, mapping };
      if (!config.url) back("URL is required", true);
    } else if (type === "CSV_FEED") {
      config = { url: opt(formData.get("url")), intervalSec: Number(formData.get("intervalSec")) || 900, skuColumn: opt(formData.get("skuColumn")) ?? "sku", qtyColumn: opt(formData.get("qtyColumn")), costColumn: opt(formData.get("costColumn")), priceColumn: opt(formData.get("priceColumn")), nameColumn: opt(formData.get("nameColumn")), supplier: opt(formData.get("supplier")), mode: opt(formData.get("mode")) ?? "both" };
      if (!config.url) back("CSV URL is required", true);
    } else {
      config = { mapping };
    }
  } catch (e) {
    back(e instanceof Error ? e.message : "Invalid configuration", true);
  }

  let key: string | null = null;
  let keyHash: string | undefined;
  let keyPrefix: string | undefined;
  if (type === "WEBHOOK") {
    key = `nd_${randomBytes(24).toString("base64url")}`;
    keyHash = hashKey(key);
    keyPrefix = key.slice(0, 10);
  }
  const row = await db.integration.create({ data: { shopId: await currentShopId(), name, type, config: config as object, keyHash, keyPrefix } });
  await resyncIntegrations().catch(() => null);
  revalidatePath("/settings");
  revalidatePath("/production");
  if (key) back(`${name} created. Copy the API key now — it is only shown once.`, false, `&newKey=${encodeURIComponent(key)}&newId=${row.id}`);
  back(`${name} created`);
}

export async function toggleIntegration(id: string) {
  await requireStaff(MANAGER_ROLES);
  const row = await db.integration.findUniqueOrThrow({ where: { id } });
  await db.integration.update({ where: { id }, data: { enabled: !row.enabled, lastError: null } });
  await resyncIntegrations().catch(() => null);
  revalidatePath("/settings");
  back(`${row.name} ${row.enabled ? "disabled" : "enabled"}`);
}

export async function deleteIntegration(id: string) {
  await requireStaff(MANAGER_ROLES);
  const row = await db.integration.delete({ where: { id } });
  await resyncIntegrations().catch(() => null);
  revalidatePath("/settings");
  back(`${row.name} removed`);
}

export async function rotateIntegrationKey(id: string) {
  await requireStaff(MANAGER_ROLES);
  const key = `nd_${randomBytes(24).toString("base64url")}`;
  await db.integration.update({ where: { id }, data: { keyHash: hashKey(key), keyPrefix: key.slice(0, 10) } });
  back("Key rotated — update the sender with the new key.", false, `&newKey=${encodeURIComponent(key)}&newId=${id}`);
}

export async function runIntegrationNow(id: string) {
  await requireStaff(MANAGER_ROLES);
  try {
    await runIntegrationOnce(id);
  } catch (e) {
    back(e instanceof Error ? e.message : "Run failed", true);
  }
  revalidatePath("/settings");
  revalidatePath("/production");
  back("Feed pulled — see the log below");
}

/** Push a sample payload through the pipeline so the shop can see it working. */
export async function sendTestEvents(id: string) {
  await requireStaff(MANAGER_ROLES);
  const row = await db.integration.findUniqueOrThrow({ where: { id } });
  const now = new Date().toISOString();
  await applyEvents(
    [
      { type: "machine.status", machine: "DEMO-01", name: "Demo press", line: "Demo line", status: "RUNNING", at: now },
      { type: "machine.count", machine: "DEMO-01", count: 5, scrap: 0, at: now },
      { type: "machine.reading", machine: "DEMO-01", metric: "temperature", value: 61.4, unit: "°C", at: now },
    ],
    { integrationId: row.id, source: `test:${row.name}` },
  );
  revalidatePath("/production");
  back("Test events applied — open Production to see DEMO-01 live");
}

// ───────── Machines & lines (manual admin) ─────────
export async function saveLine(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const id = String(formData.get("id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/production?error=Line+name+is+required");
  const data = { name, description: opt(formData.get("description")) ?? null, targetPerHour: Number(formData.get("targetPerHour")) || null };
  if (id) await db.productionLine.update({ where: { id }, data });
  else await db.productionLine.create({ data: { ...data, shopId: await currentShopId() } });
  revalidatePath("/production");
  redirect("/production?ok=Line+saved");
}

export async function deleteLine(id: string) {
  await requireStaff(MANAGER_ROLES);
  await db.productionLine.delete({ where: { id } });
  revalidatePath("/production");
  redirect("/production?ok=Line+removed");
}

export async function saveMachine(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const id = String(formData.get("id") ?? "") || null;
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim() || code;
  if (!code) redirect("/production?error=Machine+code+is+required");
  const data = { code, name, type: opt(formData.get("type")) ?? null, lineId: opt(formData.get("lineId")) ?? null, notes: opt(formData.get("notes")) ?? null, active: formData.get("active") !== "false" };
  if (id) await db.machine.update({ where: { id }, data });
  else {
    if (await db.machine.findFirst({ where: { code } })) redirect("/production?error=That+machine+code+already+exists");
    await db.machine.create({ data: { ...data, shopId: await currentShopId() } });
  }
  revalidatePath("/production");
  redirect(`/production?ok=${encodeURIComponent(`${name} saved`)}`);
}

/** Machine page: open (or jump to) the maintenance job for this machine. */
export async function createMachineJob(id: string, formData: FormData) {
  const user = await requireStaff();
  const { openMaintenanceJob } = await import("@/lib/maintenance");
  const complaint = String(formData.get("complaint") ?? "").trim() || "Maintenance";
  const { workOrder, created } = await openMaintenanceJob(id, { complaint, by: user.name, userId: user.id, source: "production page" });
  revalidatePath("/production");
  redirect(`/work-orders/${workOrder.id}?ok=${created ? "Maintenance+job+opened" : "This+machine+already+has+an+open+job"}`);
}

/** Machine page: link to an existing asset record, create one, or unlink. */
export async function linkMachineAsset(id: string, formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const choice = String(formData.get("assetId") ?? "");
  if (choice === "__new") {
    const { assetForMachine } = await import("@/lib/maintenance");
    await db.machine.update({ where: { id }, data: { assetId: null } });
    await assetForMachine(id);
  } else {
    await db.machine.update({ where: { id }, data: { assetId: choice || null } });
  }
  await db.machine.update({ where: { id }, data: { autoWorkOrder: formData.get("autoWorkOrder") === "on", hoursMetric: String(formData.get("hoursMetric") ?? "run_hours").trim() || "run_hours" } });
  revalidatePath(`/production/${id}`);
  redirect(`/production/${id}?ok=Maintenance+settings+saved`);
}

export async function setMachineStatus(id: string, status: MachineStatus) {
  const user = await requireStaff();
  await db.machine.update({ where: { id }, data: { status, lastStatusChangeAt: new Date(), lastHeartbeatAt: new Date() } });
  await db.machineEvent.create({ data: { machineId: id, type: "STATUS", status, message: `Set manually by ${user.name}` } });
  const { bus } = await import("@/lib/integrations/bus");
  bus.emit("change", { machines: [id], parts: [] });
  revalidatePath("/production");
  redirect(`/production/${id}?ok=${encodeURIComponent(`Status set to ${status.toLowerCase()}`)}`);
}

export async function deleteMachine(id: string) {
  await requireStaff(MANAGER_ROLES);
  await db.machine.delete({ where: { id } });
  revalidatePath("/production");
  redirect("/production?ok=Machine+removed");
}
