import Link from "next/link";
import { KeyRound, Play, RefreshCw, Trash2, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { Badge, Card } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { createIntegration, deleteIntegration, rotateIntegrationKey, runIntegrationNow, sendTestEvents, toggleIntegration } from "@/actions/integrations";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { IntegrationForm } from "./integration-form";
import { CopyField } from "./copy-field";

const TYPE_LABEL = { WEBHOOK: "Webhook (push)", MQTT: "MQTT (machines / PLC gateway)", REST_POLL: "REST API (poll)", CSV_FEED: "CSV feed (poll)" } as const;

export async function IntegrationsTab({ newKey, newId }: { newKey?: string; newId?: string } = {}) {
  const [rows, logs] = await Promise.all([
    db.integration.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { machines: true } } } }),
    db.ingestLog.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { integration: { select: { name: true } } } }),
  ]);
  const appUrl = process.env.APP_URL ?? "http://127.0.0.1:4500";
  const providers = { email: Boolean(process.env.RESEND_API_KEY), sms: Boolean(process.env.TWILIO_ACCOUNT_SID), ai: Boolean(process.env.ANTHROPIC_API_KEY) };

  return (
    <div className="space-y-4">
      {newKey ? (
        <div className="card p-4 border-emerald-500/40 bg-emerald-500/5">
          <div className="text-sm font-semibold text-emerald-300 flex items-center gap-2"><KeyRound size={15} /> API key for {rows.find((r) => r.id === newId)?.name ?? "the new integration"} — copy it now, it won&apos;t be shown again</div>
          <CopyField value={newKey} />
          <div className="text-xs text-muted mt-2 font-mono break-all">
            curl -X POST {appUrl}/api/ingest -H &quot;Authorization: Bearer {newKey}&quot; -H &quot;Content-Type: application/json&quot; -d &apos;{`{"events":[{"type":"machine.status","machine":"CNC-01","line":"Line A","status":"RUNNING"}]}`}&apos;
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-2" title="Connect a feed">
          <IntegrationForm action={createIntegration} />
        </Card>

        <div className="xl:col-span-3 space-y-4">
          <Card title="Connected feeds" padded={false}>
            {rows.length ? (
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <li key={r.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      <Badge tone="slate">{TYPE_LABEL[r.type]}</Badge>
                      {r.enabled ? <Badge tone="green">Enabled</Badge> : <Badge tone="slate">Disabled</Badge>}
                      {r.lastError ? <Badge tone="red">Error</Badge> : null}
                      <span className="ml-auto text-xs text-muted">{r.eventCount} events · {r.lastSeenAt ? `last ${fmtRelative(r.lastSeenAt)}` : "never received"}</span>
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {r.type === "WEBHOOK" ? <>POST {appUrl}/api/ingest · key <span className="font-mono">{r.keyPrefix}…</span></> : null}
                      {r.type === "MQTT" ? <>{String((r.config as { broker?: string }).broker)} · topics: {((r.config as { topics?: string[] }).topics ?? []).join(", ") || "#"}</> : null}
                      {r.type === "REST_POLL" || r.type === "CSV_FEED" ? <>{String((r.config as { url?: string }).url)} · every {(r.config as { intervalSec?: number }).intervalSec ?? 60}s</> : null}
                      {r._count.machines ? ` · ${r._count.machines} machine${r._count.machines === 1 ? "" : "s"}` : ""}
                    </div>
                    {r.lastError ? <div className="text-xs text-red-400 mt-1">{r.lastError}</div> : null}
                    <div className="flex flex-wrap gap-1 mt-2">
                      <form action={toggleIntegration.bind(null, r.id)}><button className="btn btn-ghost btn-sm">{r.enabled ? "Disable" : "Enable"}</button></form>
                      {r.type === "REST_POLL" || r.type === "CSV_FEED" ? <form action={runIntegrationNow.bind(null, r.id)}><button className="btn btn-ghost btn-sm"><Play size={12} /> Pull now</button></form> : null}
                      {r.type === "WEBHOOK" ? <form action={rotateIntegrationKey.bind(null, r.id)}><ConfirmButton message="Rotate the key? The old key stops working immediately." className="btn btn-ghost btn-sm"><RefreshCw size={12} /> Rotate key</ConfirmButton></form> : null}
                      <form action={sendTestEvents.bind(null, r.id)}><button className="btn btn-ghost btn-sm"><Zap size={12} /> Send test events</button></form>
                      <form action={deleteIntegration.bind(null, r.id)} className="ml-auto"><ConfirmButton message="Remove this integration?" className="btn btn-ghost btn-sm text-faint hover:text-red-400"><Trash2 size={12} /></ConfirmButton></form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-sm text-muted">No feeds connected yet. Create one on the left — a webhook key is the fastest way to start pushing machine or inventory data.</p>
            )}
          </Card>

          <Card title="Ingest log" action={<Link href="/production" className="text-xs text-accent hover:underline">Open production floor →</Link>} padded={false}>
            <ul className="divide-y divide-border max-h-80 overflow-y-auto">
              {logs.map((l) => (
                <li key={l.id} className="px-5 py-2 text-xs flex items-start gap-3">
                  <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${l.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span className="flex-1 min-w-0"><span className="text-text">{l.integration?.name ?? l.source}</span> <span className="text-muted">· {l.summary}</span>{l.error ? <div className="text-red-400 truncate">{l.error}</div> : null}</span>
                  <span className="text-faint shrink-0">{fmtDateTime(l.createdAt)}</span>
                </li>
              ))}
              {!logs.length ? <li className="px-5 py-6 text-sm text-muted text-center">Nothing received yet.</li> : null}
            </ul>
          </Card>
        </div>
      </div>

      <Card title="Service providers (.env)">
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          {[
            { label: "Email (Resend)", ok: providers.email, env: "RESEND_API_KEY, EMAIL_FROM" },
            { label: "SMS (Twilio)", ok: providers.sms, env: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM" },
            { label: "NexDrive AI (Claude)", ok: providers.ai, env: "ANTHROPIC_API_KEY" },
          ].map((p) => (
            <div key={p.label} className="rounded-lg bg-bg-elevated border border-border p-3">
              <div className="flex items-center justify-between"><span className="font-medium">{p.label}</span>{p.ok ? <Badge tone="green">Configured</Badge> : <Badge tone="amber">Not set</Badge>}</div>
              <div className="text-xs text-muted mt-1 font-mono">{p.env}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-faint mt-3">Add the keys to <code>D:\NexDrive\.env</code> and restart the server. Until then, email/SMS notifications stay queued and the AI assistant is disabled.</p>
      </Card>

      <Card title="How feeds plug in">
        <div className="grid md:grid-cols-2 gap-4 text-sm text-muted">
          <div>
            <div className="text-text font-medium mb-1">Canonical event format</div>
            <pre className="rounded-lg bg-bg-elevated border border-border p-3 text-[11px] overflow-x-auto text-text/90">{`{ "events": [
  { "type": "machine.status",  "machine": "CNC-01", "line": "Line A", "status": "RUNNING" },
  { "type": "machine.count",   "machine": "CNC-01", "count": 12, "scrap": 1 },
  { "type": "machine.reading", "machine": "CNC-01", "metric": "spindle_temp", "value": 61.2, "unit": "C" },
  { "type": "machine.alarm",   "machine": "CNC-01", "code": "E42", "message": "Coolant low", "severity": "warning" },
  { "type": "inventory.set",   "sku": "BRK-PAD-F150", "quantity": 40 },
  { "type": "inventory.adjust","sku": "OIL-FLT-PH7317", "delta": -2, "reason": "Line pull" },
  { "type": "inventory.price", "sku": "BAT-H6-AGM", "cost": 128, "price": 219, "supplier": "NAPA" }
]}`}</pre>
            <p className="mt-2">Status words are normalised automatically (<em>run / auto / 1 → RUNNING, fault / e-stop → DOWN, changeover → MAINTENANCE</em>). Unknown machines and lines are created on first contact; unknown SKUs are created when a <code>name</code> is included.</p>
          </div>
          <div>
            <div className="text-text font-medium mb-1">Non-standard payloads → mapping</div>
            <pre className="rounded-lg bg-bg-elevated border border-border p-3 text-[11px] overflow-x-auto text-text/90">{`{
  "events": "$.data.records",
  "type": "machine.status",
  "fields": { "machine": "$.device.id", "status": "$.state", "line": "=Line A" },
  "statusMap": { "2": "RUNNING", "3": "DOWN", "0": "IDLE" },
  "topicPattern": "plant/{line}/{machine}/status"
}`}</pre>
            <p className="mt-2">Paths are <code>$.a.b[0].c</code>; <code>=literal</code> sets a constant; <code>$topic</code> is the MQTT topic. PLCs speaking Modbus/OPC-UA/EtherNet-IP connect through any edge gateway (Node-RED, Kepware, Ignition, Siemens IoT2050, Moxa, Advantech WISE…) publishing to MQTT or posting JSON — that is the standard shop-floor pattern and needs no custom code here.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
