import { NextResponse, type NextRequest } from "next/server";
import { rawDb, withShop } from "@/lib/db";
import { applyEvents } from "@/lib/integrations/events";
import { extractRecords, mapRecord, type Mapping } from "@/lib/integrations/mapping";
import { hashKey } from "@/lib/integrations/runtime";

/**
 * POST /api/ingest — push endpoint for machines, PLC gateways, MES/ERP and inventory systems.
 *
 *   Authorization: Bearer <integration api key>     (or  x-api-key: <key>)
 *   Content-Type: application/json
 *   { "events": [ { "type": "machine.status", "machine": "CNC-01", "status": "RUNNING" }, … ] }
 *
 * Accepts a single event object, an array, or { events: [...] }. If the integration has a
 * mapping configured, arbitrary payloads are translated before validation.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : (req.headers.get("x-api-key") ?? "").trim();
  if (!key) return NextResponse.json({ ok: false, error: "Missing API key" }, { status: 401 });
  let integration = await rawDb.integration.findUnique({ where: { keyHash: hashKey(key) } });
  if (!integration) {
    // an API key from Settings -> API & Webhooks with the ingest scope works here too
    const apiKey = await rawDb.apiKey.findUnique({ where: { keyHash: hashKey(key) } });
    if (apiKey && apiKey.enabled && apiKey.scopes.includes("ingest") && (!apiKey.expiresAt || apiKey.expiresAt > new Date())) {
      integration = { id: "", shopId: apiKey.shopId, name: `api:${apiKey.name}`, type: "WEBHOOK", enabled: true, keyHash: null, keyPrefix: null, config: {}, lastSeenAt: null, lastError: null, eventCount: 0, createdAt: new Date(), updatedAt: new Date() };
    }
  }
  if (!integration || !integration.enabled) return NextResponse.json({ ok: false, error: "Invalid or disabled API key" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON" }, { status: 400 });
  }
  const mapping = ((integration.config as { mapping?: Mapping } | null)?.mapping ?? undefined) as Mapping | undefined;
  const records = extractRecords(payload, mapping).map((r) => mapRecord(r, mapping));
  if (!records.length) return NextResponse.json({ ok: false, error: "No events found in payload" }, { status: 400 });
  if (records.length > 5000) return NextResponse.json({ ok: false, error: "Max 5000 events per request" }, { status: 413 });

  const shopId = integration.shopId;
  const result = await withShop(shopId, () => applyEvents(records, { integrationId: integration.id || undefined, source: `webhook:${integration.name}` }));
  return NextResponse.json({ ok: result.errors.length === 0, applied: result.applied, rejected: result.errors.length, errors: result.errors.slice(0, 20) }, { status: result.applied ? 200 : 422 });
}

export function GET() {
  return NextResponse.json({
    ok: true,
    usage: "POST JSON events with Authorization: Bearer <key>",
    eventTypes: ["machine.status", "machine.count", "machine.reading", "machine.alarm", "machine.heartbeat", "inventory.set", "inventory.adjust", "inventory.price"],
    example: { events: [{ type: "machine.status", machine: "CNC-01", line: "Line A", status: "RUNNING" }, { type: "machine.count", machine: "CNC-01", count: 12, scrap: 1 }, { type: "inventory.set", sku: "BRK-PAD-F150", quantity: 40 }] },
  });
}
