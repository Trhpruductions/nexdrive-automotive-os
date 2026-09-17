import { KeyRound, Plus, RefreshCw, Send, Trash2, Webhook } from "lucide-react";
import { db } from "@/lib/db";
import { Badge, Card, Field } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { createApiKey, createWebhook, deleteApiKey, deleteWebhook, rotateApiKey, testWebhook, toggleApiKey, toggleWebhook } from "@/actions/apikeys";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { CopyField } from "./copy-field";

const SCOPE_INFO = [
  { key: "read", label: "Read", text: "Customers, vehicles, work orders, invoices, parts, schedule, production" },
  { key: "write", label: "Write", text: "Create / update customers, vehicles, work orders, appointments, parts & stock" },
  { key: "ingest", label: "Ingest", text: "Push machine & inventory events (same as an integration feed)" },
];

export async function ApiTab({ newKey, newId, newSecret, newHook }: { newKey?: string; newId?: string; newSecret?: string; newHook?: string }) {
  const [keys, hooks, deliveries] = await Promise.all([
    db.apiKey.findMany({ orderBy: { createdAt: "desc" } }),
    db.webhookEndpoint.findMany({ orderBy: { createdAt: "desc" } }),
    db.webhookDelivery.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { endpoint: { select: { name: true } } } }),
  ]);
  const appUrl = process.env.APP_URL ?? "http://127.0.0.1:4500";

  return (
    <div className="space-y-4">
      {newKey ? (
        <div className="card p-4 border-emerald-500/40 bg-emerald-500/5">
          <div className="text-sm font-semibold text-emerald-300 flex items-center gap-2"><KeyRound size={15} /> API key for {keys.find((k) => k.id === newId)?.name ?? "the new key"} — copy it now, it won&apos;t be shown again</div>
          <CopyField value={newKey} />
          <div className="text-xs text-muted mt-2 font-mono break-all">curl {appUrl}/api/v1/me -H &quot;Authorization: Bearer {newKey}&quot;</div>
        </div>
      ) : null}
      {newSecret ? (
        <div className="card p-4 border-emerald-500/40 bg-emerald-500/5">
          <div className="text-sm font-semibold text-emerald-300 flex items-center gap-2"><Webhook size={15} /> Signing secret for {hooks.find((h) => h.id === newHook)?.name ?? "the new webhook"} — verify <code>X-NexDrive-Signature</code> with it</div>
          <CopyField value={newSecret} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-2" title="Create API key">
          <form action={createApiKey} className="space-y-3">
            <Field label="Name" hint="Which software will use it"><input name="name" required className="input" placeholder="QuickBooks sync, PartsTech, shop kiosk…" /></Field>
            <div>
              <span className="label">Scopes</span>
              <div className="space-y-1.5">
                {SCOPE_INFO.map((s) => (
                  <label key={s.key} className="card p-2.5 flex items-start gap-2.5 cursor-pointer has-[:checked]:border-accent/60">
                    <input type="checkbox" name="scopes" value={s.key} defaultChecked={s.key === "read"} className="mt-0.5 accent-[var(--accent)]" />
                    <span><span className="text-sm font-medium">{s.label}</span><span className="block text-xs text-muted">{s.text}</span></span>
                  </label>
                ))}
              </div>
            </div>
            <Field label="Expires (optional)"><input name="expiresAt" type="date" className="input" /></Field>
            <button className="btn btn-primary w-full"><Plus size={15} /> Create key</button>
          </form>
        </Card>

        <Card className="xl:col-span-3" title="API keys" padded={false}>
          {keys.length ? (
            <ul className="divide-y divide-border">
              {keys.map((k) => (
                <li key={k.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{k.name}</span>
                    <span className="font-mono text-xs text-muted">{k.keyPrefix}…</span>
                    {k.scopes.map((s) => <Badge key={s} tone={s === "write" ? "amber" : s === "ingest" ? "violet" : "blue"}>{s}</Badge>)}
                    {!k.enabled ? <Badge tone="slate">Disabled</Badge> : k.expiresAt && k.expiresAt < new Date() ? <Badge tone="red">Expired</Badge> : <Badge tone="green">Active</Badge>}
                    <span className="ml-auto text-xs text-muted">{k.useCount} calls · {k.lastUsedAt ? `last ${fmtRelative(k.lastUsedAt)}` : "never used"}</span>
                  </div>
                  <div className="text-xs text-faint mt-1">Created {fmtDateTime(k.createdAt)}{k.createdBy ? ` by ${k.createdBy}` : ""}{k.expiresAt ? ` · expires ${fmtDateTime(k.expiresAt)}` : ""}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <form action={toggleApiKey.bind(null, k.id)}><button className="btn btn-ghost btn-sm">{k.enabled ? "Disable" : "Enable"}</button></form>
                    <form action={rotateApiKey.bind(null, k.id)}><ConfirmButton message="Rotate this key? The old key stops working immediately." className="btn btn-ghost btn-sm"><RefreshCw size={12} /> Rotate</ConfirmButton></form>
                    <form action={deleteApiKey.bind(null, k.id)} className="ml-auto"><ConfirmButton message="Revoke and delete this key?" className="btn btn-ghost btn-sm text-faint hover:text-red-400"><Trash2 size={12} /> Revoke</ConfirmButton></form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-muted">No API keys yet. Create one on the left for each piece of software that needs to connect.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-2" title="Add outbound webhook">
          <form action={createWebhook} className="space-y-3">
            <Field label="Name"><input name="name" required className="input" placeholder="Accounting system, SMS marketing, Zapier…" /></Field>
            <Field label="Endpoint URL"><input name="url" required className="input" placeholder="https://example.com/nexdrive/webhook" /></Field>
            <div>
              <span className="label">Events (none selected = all)</span>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {WEBHOOK_EVENTS.filter((e) => e !== "ping").map((e) => (
                  <label key={e} className="flex items-center gap-1.5 text-muted"><input type="checkbox" name="events" value={e} className="accent-[var(--accent)]" /> {e}</label>
                ))}
              </div>
            </div>
            <button className="btn btn-primary w-full"><Plus size={15} /> Add webhook</button>
          </form>
        </Card>

        <div className="xl:col-span-3 space-y-4">
          <Card title="Webhook endpoints" padded={false}>
            {hooks.length ? (
              <ul className="divide-y divide-border">
                {hooks.map((h) => (
                  <li key={h.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{h.name}</span>
                      {h.enabled ? <Badge tone="green">Enabled</Badge> : <Badge tone="slate">Paused</Badge>}
                      {h.failures >= 3 ? <Badge tone="red">{h.failures} failures</Badge> : null}
                      <span className="ml-auto text-xs text-muted">{h.lastDeliveredAt ? `last ${fmtRelative(h.lastDeliveredAt)} · HTTP ${h.lastStatus ?? "—"}` : "never delivered"}</span>
                    </div>
                    <div className="text-xs text-muted mt-1 font-mono break-all">{h.url}</div>
                    <div className="text-xs text-faint mt-1">{h.events.length ? h.events.join(", ") : "all events"}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <form action={testWebhook.bind(null, h.id)}><button className="btn btn-ghost btn-sm"><Send size={12} /> Send ping</button></form>
                      <form action={toggleWebhook.bind(null, h.id)}><button className="btn btn-ghost btn-sm">{h.enabled ? "Pause" : "Enable"}</button></form>
                      <form action={deleteWebhook.bind(null, h.id)} className="ml-auto"><ConfirmButton message="Remove this webhook?" className="btn btn-ghost btn-sm text-faint hover:text-red-400"><Trash2 size={12} /></ConfirmButton></form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-sm text-muted">No webhooks yet. Add one to have NexDrive notify other software when work orders move, invoices are paid, appointments are booked, machines change state…</p>
            )}
          </Card>
          <Card title="Recent deliveries" padded={false}>
            <ul className="divide-y divide-border max-h-72 overflow-y-auto">
              {deliveries.map((d) => (
                <li key={d.id} className="px-5 py-2 text-xs flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${d.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span className="font-mono text-accent">{d.event}</span>
                  <span className="text-muted truncate">→ {d.endpoint.name}{d.status ? ` · HTTP ${d.status}` : ""}{d.durationMs != null ? ` · ${d.durationMs}ms` : ""}{d.error ? ` · ${d.error}` : ""}</span>
                  <span className="ml-auto text-faint shrink-0">{fmtDateTime(d.createdAt)}</span>
                </li>
              ))}
              {!deliveries.length ? <li className="px-5 py-6 text-sm text-muted text-center">Nothing delivered yet.</li> : null}
            </ul>
          </Card>
        </div>
      </div>

      <Card title="Using the API">
        <div className="grid md:grid-cols-2 gap-5 text-sm text-muted">
          <div className="space-y-2">
            <p>Base URL <code className="text-text">{appUrl}/api/v1</code> · send the key as <code className="text-text">Authorization: Bearer nd_live_…</code>. Every list supports <code>?page=&amp;limit=</code>; <code>GET /api/v1</code> returns the full endpoint index as JSON.</p>
            <pre className="rounded-lg bg-bg-elevated border border-border p-3 text-[11px] overflow-x-auto text-text/90">{`# who am I / shop info
curl ${appUrl}/api/v1/me -H "Authorization: Bearer $KEY"

# search customers
curl "${appUrl}/api/v1/customers?q=smith" -H "Authorization: Bearer $KEY"

# create an estimate with lines
curl -X POST ${appUrl}/api/v1/work-orders -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \\
  -d '{"vehicleId":"…","complaint":"Brakes grinding","lines":[{"kind":"LABOR","description":"Front brakes","hours":2},{"kind":"PART","description":"Pads","quantity":1,"unitPrice":89.99}]}'

# receive stock by SKU
curl -X PATCH ${appUrl}/api/v1/parts/BRK-PAD-F150 -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{"adjust":12,"reason":"PO 4471"}'`}</pre>
          </div>
          <div className="space-y-2">
            <p>Webhooks POST a JSON envelope <code className="text-text">{`{ id, event, at, data }`}</code> with headers <code>X-NexDrive-Event</code>, <code>X-NexDrive-Delivery</code> and <code>X-NexDrive-Signature: sha256=…</code> (HMAC-SHA256 of the raw body with the endpoint secret). Failed deliveries retry twice.</p>
            <pre className="rounded-lg bg-bg-elevated border border-border p-3 text-[11px] overflow-x-auto text-text/90">{`// Node.js receiver
import { createHmac, timingSafeEqual } from "node:crypto";
app.post("/nexdrive/webhook", express.raw({ type: "*/*" }), (req, res) => {
  const expected = "sha256=" + createHmac("sha256", SECRET).update(req.body).digest("hex");
  const given = req.get("X-NexDrive-Signature") ?? "";
  if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return res.sendStatus(401);
  const { event, data } = JSON.parse(req.body);
  // event: "invoice.paid", data: { number, total, customer… }
  res.sendStatus(200);
});`}</pre>
            <p className="text-xs text-faint">Machine / inventory feeds (MQTT, REST, CSV, webhook keys) live under the Integrations tab; an API key with the <em>ingest</em> scope can also post events to <code>/api/v1/events</code>.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
