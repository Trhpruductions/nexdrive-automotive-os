import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { applyEvents, sweepOfflineMachines } from "./events";
import { extractRecords, mapRecord, matchTopic, parseCsv, type Mapping } from "./mapping";

/**
 * Long-running connectors (MQTT subscriptions, REST/CSV pollers). Started once per
 * server process from src/instrumentation.ts; re-syncs with the Integration table
 * every 30s so enabling/disabling in Settings takes effect without a restart.
 */

type Runner = { stop: () => void; kind: string };
type RuntimeState = { runners: Map<string, Runner>; timer?: NodeJS.Timeout; sweep?: NodeJS.Timeout; started: boolean };
const g = globalThis as unknown as { __ndRuntime?: RuntimeState };
const state: RuntimeState = g.__ndRuntime ?? (g.__ndRuntime = { runners: new Map<string, Runner>(), started: false });

export function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export async function startIntegrationRuntime() {
  if (state.started) return;
  state.started = true;
  await sync().catch((e) => console.error("[integrations] sync failed", e));
  state.timer = setInterval(() => sync().catch((e) => console.error("[integrations] sync failed", e)), 30_000);
  state.sweep = setInterval(() => sweepOfflineMachines(5).catch(() => null), 60_000);
  console.log("[integrations] runtime started");
}

export async function stopIntegrationRuntime() {
  if (state.timer) clearInterval(state.timer);
  if (state.sweep) clearInterval(state.sweep);
  for (const r of state.runners.values()) r.stop();
  state.runners.clear();
  state.started = false;
}

/** Force a re-sync (called after settings changes). */
export async function resyncIntegrations() {
  await sync();
}

async function sync() {
  const rows = await db.integration.findMany({ where: { enabled: true, type: { in: ["MQTT", "REST_POLL", "CSV_FEED"] } } });
  const want = new Map(rows.map((r) => [r.id, r]));
  // stop removed / changed
  for (const [id, runner] of state.runners) {
    const row = want.get(id);
    const sig = row ? `${row.type}:${row.updatedAt.getTime()}` : null;
    if (!row || runner.kind !== sig) {
      runner.stop();
      state.runners.delete(id);
    }
  }
  // start new
  for (const row of rows) {
    if (state.runners.has(row.id)) continue;
    const sig = `${row.type}:${row.updatedAt.getTime()}`;
    try {
      const runner = row.type === "MQTT" ? await startMqtt(row) : row.type === "REST_POLL" ? startPoller(row, pollRest) : startPoller(row, pollCsv);
      state.runners.set(row.id, { ...runner, kind: sig });
    } catch (e) {
      await db.integration.update({ where: { id: row.id }, data: { lastError: e instanceof Error ? e.message : String(e) } }).catch(() => null);
    }
  }
}

type Row = { id: string; name: string; config: unknown };
type Cfg = { url?: string; method?: string; headers?: Record<string, string>; intervalSec?: number; mapping?: Mapping; broker?: string; username?: string; password?: string; topics?: string[]; columns?: Record<string, string>; skuColumn?: string; qtyColumn?: string; costColumn?: string; priceColumn?: string; nameColumn?: string; supplier?: string; mode?: "set" | "price" | "both" };

function cfgOf(row: Row): Cfg {
  return (row.config && typeof row.config === "object" ? row.config : {}) as Cfg;
}

// ───────── MQTT ─────────
async function startMqtt(row: Row): Promise<Omit<Runner, "kind">> {
  const cfg = cfgOf(row);
  if (!cfg.broker) throw new Error("MQTT broker URL is required");
  const mqtt = await import("mqtt");
  const client = mqtt.connect(cfg.broker, { username: cfg.username || undefined, password: cfg.password || undefined, reconnectPeriod: 5000, connectTimeout: 10_000, clientId: `nexdrive-${row.id.slice(-6)}-${Math.random().toString(16).slice(2, 6)}` });
  const topics = (cfg.topics?.length ? cfg.topics : ["#"]).map((t) => t.trim()).filter(Boolean);
  client.on("connect", () => {
    client.subscribe(topics, (err) => {
      if (err) db.integration.update({ where: { id: row.id }, data: { lastError: `subscribe: ${err.message}` } }).catch(() => null);
      else db.integration.update({ where: { id: row.id }, data: { lastError: null, lastSeenAt: new Date() } }).catch(() => null);
    });
  });
  client.on("error", (err) => {
    db.integration.update({ where: { id: row.id }, data: { lastError: err.message } }).catch(() => null);
  });
  client.on("message", (topic, buf) => {
    void handleMqttMessage(row, cfg, topic, buf.toString("utf8"));
  });
  return { stop: () => client.end(true) };
}

async function handleMqttMessage(row: Row, cfg: Cfg, topic: string, text: string) {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    // plain scalar payloads: "RUNNING", "42", "61.5" — infer from the topic's last segment
    const last = topic.split("/").pop()?.toLowerCase() ?? "";
    const n = Number(text);
    payload = last.includes("status") || last.includes("state") ? { status: text.trim() } : last.includes("count") || last.includes("parts") ? { count: n } : Number.isFinite(n) ? { metric: last, value: n } : { message: text.trim() };
  }
  const fromTopic = matchTopic(cfg.mapping?.topicPattern, topic);
  const records = extractRecords(payload, cfg.mapping).map((r) => {
    const mapped = mapRecord(r, cfg.mapping, { ...fromTopic, $topic: topic });
    if (!mapped.type) mapped.type = inferType(mapped, topic);
    if (!mapped.machine && fromTopic.machine) mapped.machine = fromTopic.machine;
    if (!mapped.machine) mapped.machine = topic.split("/").filter((s) => s && !/^(status|state|count|parts|reading|alarm|heartbeat|data)$/i.test(s)).pop();
    return mapped;
  });
  await applyEvents(records, { integrationId: row.id, source: `mqtt:${topic}` });
}

function inferType(rec: Record<string, unknown>, hint = ""): string {
  const h = hint.toLowerCase();
  if (rec.sku != null) return rec.delta != null ? "inventory.adjust" : rec.cost != null || rec.price != null ? "inventory.price" : "inventory.set";
  if (rec.status != null || /status|state/.test(h)) return "machine.status";
  if (rec.count != null || /count|parts|output/.test(h)) return "machine.count";
  if (rec.metric != null && rec.value != null) return "machine.reading";
  if (rec.message != null || /alarm|fault/.test(h)) return "machine.alarm";
  return "machine.heartbeat";
}

// ───────── Pollers ─────────
function startPoller(row: Row, fn: (row: Row, cfg: Cfg) => Promise<void>): Omit<Runner, "kind"> {
  const cfg = cfgOf(row);
  const every = Math.max(10, Number(cfg.intervalSec) || 60) * 1000;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await fn(row, cfg);
    } catch (e) {
      await db.integration.update({ where: { id: row.id }, data: { lastError: e instanceof Error ? e.message : String(e) } }).catch(() => null);
      await db.ingestLog.create({ data: { integrationId: row.id, source: `poll:${row.name}`, ok: false, summary: "Poll failed", error: e instanceof Error ? e.message : String(e) } }).catch(() => null);
    } finally {
      busy = false;
    }
  };
  void tick();
  const t = setInterval(tick, every);
  return { stop: () => clearInterval(t) };
}

async function fetchText(cfg: Cfg) {
  if (!cfg.url) throw new Error("URL is required");
  const res = await fetch(cfg.url, { method: cfg.method || "GET", headers: cfg.headers ?? {}, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${cfg.url}`);
  return res.text();
}

async function pollRest(row: Row, cfg: Cfg) {
  const text = await fetchText(cfg);
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Response was not JSON");
  }
  const records = extractRecords(payload, cfg.mapping).map((r) => {
    const mapped = mapRecord(r, cfg.mapping);
    if (!mapped.type) mapped.type = inferType(mapped);
    return mapped;
  });
  await applyEvents(records, { integrationId: row.id, source: `rest:${row.name}` });
}

async function pollCsv(row: Row, cfg: Cfg) {
  const text = await fetchText(cfg);
  const rows = parseCsv(text);
  const skuCol = cfg.skuColumn || "sku";
  const events: Record<string, unknown>[] = [];
  for (const r of rows) {
    const sku = r[skuCol];
    if (!sku) continue;
    const name = cfg.nameColumn ? r[cfg.nameColumn] : undefined;
    if ((cfg.mode ?? "both") !== "price" && cfg.qtyColumn && r[cfg.qtyColumn] !== "") events.push({ type: "inventory.set", sku, quantity: Number(r[cfg.qtyColumn]), name, reason: `Feed: ${row.name}` });
    if ((cfg.mode ?? "both") !== "set" && (cfg.costColumn || cfg.priceColumn)) {
      events.push({ type: "inventory.price", sku, name, supplier: cfg.supplier, cost: cfg.costColumn && r[cfg.costColumn] !== "" ? Number(r[cfg.costColumn]) : undefined, price: cfg.priceColumn && r[cfg.priceColumn] !== "" ? Number(r[cfg.priceColumn]) : undefined });
    }
  }
  await applyEvents(events, { integrationId: row.id, source: `csv:${row.name}` });
}

/** Run one poll immediately (Settings → "Test now"). */
export async function runIntegrationOnce(id: string) {
  const row = await db.integration.findUniqueOrThrow({ where: { id } });
  const cfg = cfgOf(row);
  if (row.type === "REST_POLL") await pollRest(row, cfg);
  else if (row.type === "CSV_FEED") await pollCsv(row, cfg);
  else throw new Error("Only REST and CSV feeds can be run on demand");
}
