"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Field } from "@/components/ui";

type Type = "WEBHOOK" | "MQTT" | "REST_POLL" | "CSV_FEED";

export function IntegrationForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [type, setType] = useState<Type>("WEBHOOK");
  return (
    <form action={action} className="space-y-3">
      <Field label="Name"><input name="name" required className="input" placeholder="Line A PLC gateway, NAPA stock feed…" /></Field>
      <Field label="Type">
        <select name="type" value={type} onChange={(e) => setType(e.target.value as Type)} className="select">
          <option value="WEBHOOK">Webhook — machines / MES / ERP push JSON to us</option>
          <option value="MQTT">MQTT — subscribe to a broker (PLC / IoT gateway)</option>
          <option value="REST_POLL">REST API — we poll a JSON endpoint</option>
          <option value="CSV_FEED">CSV feed — we poll a supplier stock / price file</option>
        </select>
      </Field>

      {type === "WEBHOOK" ? (
        <p className="text-xs text-muted">You&apos;ll get an API key. Any system that can make an HTTPS POST (PLC gateway, Node-RED, MES, ERP, a Python script on the line) sends events to <code>/api/ingest</code>.</p>
      ) : null}

      {type === "MQTT" ? (
        <>
          <Field label="Broker URL"><input name="broker" required className="input" placeholder="mqtt://192.168.1.50:1883  or  mqtts://broker.example.com:8883" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username"><input name="username" className="input" autoComplete="off" /></Field>
            <Field label="Password"><input name="password" type="password" className="input" autoComplete="new-password" /></Field>
          </div>
          <Field label="Topics (one per line)" hint="MQTT wildcards work: plant/+/status, plant/#"><textarea name="topics" rows={3} className="textarea font-mono text-xs" placeholder={"plant/#"} /></Field>
        </>
      ) : null}

      {type === "REST_POLL" ? (
        <>
          <Field label="URL"><input name="url" required className="input" placeholder="https://mes.local/api/machines/status" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Method"><select name="method" className="select" defaultValue="GET"><option>GET</option><option>POST</option></select></Field>
            <Field label="Poll every (seconds)"><input name="intervalSec" type="number" min={10} defaultValue={60} className="input" /></Field>
          </div>
          <Field label="Headers (JSON, optional)"><textarea name="headers" rows={2} className="textarea font-mono text-xs" placeholder={'{ "Authorization": "Bearer …" }'} /></Field>
        </>
      ) : null}

      {type === "CSV_FEED" ? (
        <>
          <Field label="CSV URL"><input name="url" required className="input" placeholder="https://supplier.example.com/stock.csv" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Poll every (seconds)"><input name="intervalSec" type="number" min={60} defaultValue={900} className="input" /></Field>
            <Field label="Apply"><select name="mode" className="select" defaultValue="both"><option value="both">Stock + prices</option><option value="set">Stock only</option><option value="price">Prices only</option></select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU column"><input name="skuColumn" defaultValue="sku" className="input" /></Field>
            <Field label="Quantity column"><input name="qtyColumn" placeholder="qty" className="input" /></Field>
            <Field label="Cost column"><input name="costColumn" placeholder="cost" className="input" /></Field>
            <Field label="Price column"><input name="priceColumn" placeholder="price" className="input" /></Field>
            <Field label="Name column"><input name="nameColumn" placeholder="description" className="input" /></Field>
            <Field label="Supplier"><input name="supplier" placeholder="NAPA Auto Parts" className="input" /></Field>
          </div>
        </>
      ) : null}

      {type !== "CSV_FEED" ? (
        <Field label="Field mapping (JSON, optional)" hint="Leave blank if the sender uses the canonical format">
          <textarea name="mapping" rows={4} className="textarea font-mono text-xs" placeholder={'{ "fields": { "machine": "$.device.id", "status": "$.state" }, "statusMap": { "2": "RUNNING" } }'} />
        </Field>
      ) : null}

      <button className="btn btn-primary w-full"><Plus size={15} /> Create integration</button>
    </form>
  );
}
