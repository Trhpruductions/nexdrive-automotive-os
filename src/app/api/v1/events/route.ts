import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { applyEvents } from "@/lib/integrations/events";
import { extractRecords, mapRecord } from "@/lib/integrations/mapping";

/** POST /api/v1/events — same event format as /api/ingest, authenticated with an API key (ingest scope). */
export const POST = handler("ingest", async (req, { key }) => {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_body", message: "Body must be JSON" } }, { status: 400 });
  }
  const records = extractRecords(payload).map((r) => mapRecord(r, undefined));
  if (!records.length) return NextResponse.json({ error: { code: "validation", message: "No events found in payload" } }, { status: 422 });
  if (records.length > 5000) return NextResponse.json({ error: { code: "too_large", message: "Max 5000 events per request" } }, { status: 413 });
  const result = await applyEvents(records, { source: `api:${key.name}` });
  return NextResponse.json({ ok: result.errors.length === 0, applied: result.applied, rejected: result.errors.length, errors: result.errors.slice(0, 20) }, { status: result.applied ? 200 : 422 });
});
