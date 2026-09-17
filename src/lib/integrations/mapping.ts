/**
 * Turns arbitrary machine / ERP / supplier JSON into canonical events.
 *
 * A mapping is a small JSON object stored on the integration:
 * {
 *   "events": "$.data.items",            // optional: path to the array of records (default: root, or `events`)
 *   "type": "machine.status",            // fixed event type, or a path ("$.kind") + "typeMap"
 *   "typeMap": { "state": "machine.status", "counter": "machine.count" },
 *   "fields": {                          // canonical field ← path (or literal via "=value")
 *     "machine": "$.device.id",
 *     "status":  "$.payload.state",
 *     "count":   "$.payload.parts",
 *     "line":    "=Line A"
 *   },
 *   "statusMap": { "2": "RUNNING", "3": "DOWN" }   // optional value translation
 * }
 * Paths are dot/bracket paths: "$.a.b[0].c" or "a.b.c". "$topic" refers to the MQTT topic.
 */
export type Mapping = {
  events?: string;
  type?: string;
  typeMap?: Record<string, string>;
  fields?: Record<string, string>;
  statusMap?: Record<string, string>;
  /** MQTT: template like "plant/{line}/{machine}/status" to pull fields from the topic */
  topicPattern?: string;
};

export function getPath(obj: unknown, path: string): unknown {
  if (path == null) return undefined;
  if (path.startsWith("=")) return path.slice(1);
  let p = path.trim();
  if (p === "$" || p === "") return obj;
  if (p.startsWith("$.")) p = p.slice(2);
  else if (p.startsWith("$")) p = p.slice(1);
  const parts = p.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function extractRecords(payload: unknown, mapping?: Mapping): unknown[] {
  if (mapping?.events) {
    const arr = getPath(payload, mapping.events);
    return Array.isArray(arr) ? arr : arr != null ? [arr] : [];
  }
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray((payload as { events?: unknown }).events)) return (payload as { events: unknown[] }).events;
  return payload == null ? [] : [payload];
}

/** Apply a mapping to one record. Returns a canonical-looking object (validated later). */
export function mapRecord(record: unknown, mapping: Mapping | undefined, extra: Record<string, unknown> = {}): Record<string, unknown> {
  if (!mapping || (!mapping.fields && !mapping.type)) {
    return { ...(record && typeof record === "object" ? (record as Record<string, unknown>) : {}), ...extra };
  }
  const out: Record<string, unknown> = { ...extra };
  const rec = record && typeof record === "object" ? (record as Record<string, unknown>) : {};
  let type: unknown = mapping.type;
  if (type && typeof type === "string" && (type.startsWith("$") || type.includes("."))) {
    if (!type.startsWith("machine.") && !type.startsWith("inventory.")) type = getPath(rec, type);
  }
  if (mapping.typeMap && type != null) type = mapping.typeMap[String(type)] ?? type;
  if (type) out.type = type;
  for (const [field, path] of Object.entries(mapping.fields ?? {})) {
    const v = path === "$topic" ? extra.$topic : getPath(rec, path);
    if (v !== undefined) out[field] = v;
  }
  if (mapping.statusMap && out.status != null) out.status = mapping.statusMap[String(out.status)] ?? out.status;
  // fall through untouched canonical keys so partial mappings work
  for (const k of ["machine", "line", "name", "status", "count", "good", "scrap", "metric", "value", "unit", "code", "message", "sku", "quantity", "delta", "cost", "price", "at", "reason"]) {
    if (out[k] === undefined && rec[k] !== undefined) out[k] = rec[k];
  }
  delete out.$topic;
  return out;
}

/** "plant/{line}/{machine}/status" + "plant/A/CNC-01/status" → { line: "A", machine: "CNC-01" } */
export function matchTopic(pattern: string | undefined, topic: string): Record<string, string> {
  if (!pattern) return {};
  const names: string[] = [];
  const re = new RegExp(
    "^" +
      pattern
        .split("/")
        .map((seg) => {
          const m = /^\{(\w+)\}$/.exec(seg);
          if (m) {
            names.push(m[1]);
            return "([^/]+)";
          }
          if (seg === "+") return "[^/]+";
          if (seg === "#") return ".*";
          return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("/") +
      "$",
  );
  const m = re.exec(topic);
  if (!m) return {};
  return Object.fromEntries(names.map((n, i) => [n, m[i + 1]]));
}

/** Minimal CSV parser (quoted fields, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}
