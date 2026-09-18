"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Save, X } from "lucide-react";
import { saveCannedService } from "@/actions/settings";
import { Field } from "@/components/ui";

type Part = { id: string; name: string; sku: string; price: number };
type Initial = { id: string; name: string; description: string | null; laborHours: number; laborRate: number | null; intervalMiles?: number | null; intervalMonths?: number | null; parts: { partId: string; quantity: number }[] };

export function CannedServiceEditor({ parts, initial }: { parts: Part[]; initial?: Initial }) {
  const [rows, setRows] = useState<{ partId: string; quantity: number }[]>(initial?.parts ?? []);
  return (
    <form action={saveCannedService} className="space-y-3">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Field label="Name"><input name="name" required defaultValue={initial?.name ?? ""} className="input" placeholder="Front Brake Job" /></Field>
      <Field label="Description"><input name="description" defaultValue={initial?.description ?? ""} className="input" placeholder="What's included" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Labor hours"><input name="laborHours" type="number" step="0.05" min="0" required defaultValue={initial?.laborHours ?? 1} className="input" /></Field>
        <Field label="Labor rate override" hint="Blank = shop rate"><input name="laborRate" type="number" step="0.01" min="0" defaultValue={initial?.laborRate ?? ""} className="input" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Repeat every (miles)" hint="Schedules the next reminder when invoiced"><input name="intervalMiles" type="number" step="500" min="0" defaultValue={initial?.intervalMiles ?? ""} className="input" placeholder="5000" /></Field>
        <Field label="…or every (months)"><input name="intervalMonths" type="number" step="1" min="0" defaultValue={initial?.intervalMonths ?? ""} className="input" placeholder="6" /></Field>
      </div>
      <div>
        <span className="label">Parts included</span>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <select name="partId" value={r.partId} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, partId: e.target.value } : x)))} className="select" required>
                <option value="" disabled>Choose part…</option>
                {parts.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
              </select>
              <input name="partQty" type="number" step="0.01" min="0.01" value={r.quantity} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))} className="input w-20" />
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="btn btn-ghost btn-sm text-faint hover:text-red-400" aria-label="Remove"><X size={14} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setRows([...rows, { partId: "", quantity: 1 }])} className="btn btn-secondary btn-sm"><Plus size={13} /> Add part</button>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button className="btn btn-primary"><Save size={15} /> {initial ? "Save service" : "Create service"}</button>
        {initial ? <Link href="/settings?tab=services" className="btn btn-ghost">New instead</Link> : null}
      </div>
    </form>
  );
}
