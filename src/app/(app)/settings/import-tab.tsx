"use client";

import { useState, useTransition } from "react";
import { FileUp, Upload } from "lucide-react";
import { importRows, type ImportSummary } from "@/actions/import";
import { autoMap, IMPORT_FIELDS, parseCsv, type ImportEntity } from "@/lib/csv";

const ENTITIES: { key: ImportEntity; label: string; blurb: string }[] = [
  { key: "customers", label: "Customers", blurb: "Names, contact details and addresses. Existing customers are matched by email, then phone, then name." },
  { key: "vehicles", label: "Vehicles", blurb: "Year/make/model with the owner's email, phone or name. Matched by VIN, then plate." },
  { key: "parts", label: "Parts & inventory", blurb: "SKU, name, quantities and prices. Matched by SKU; suppliers are created by name." },
];

/** Settings → Import: CSV upload → column mapping → preview → import in chunks. */
export function ImportTab() {
  const [entity, setEntity] = useState<ImportEntity>("customers");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fields = IMPORT_FIELDS[entity];

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    setSummary(null);
    const text = await f.text();
    const parsed = parseCsv(text);
    if (!parsed.headers.length || !parsed.rows.length) return setError("That file has no data rows.");
    setFileName(f.name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMap(autoMap(entity, parsed.headers));
  }

  function switchEntity(e: ImportEntity) {
    setEntity(e);
    setSummary(null);
    if (headers.length) setMap(autoMap(e, headers));
  }

  const missing = fields.filter((f) => f.required && !map[f.key]).map((f) => f.label);
  const nameOk = entity !== "customers" || map.firstName || map.lastName || map.fullName;
  const ownerOk = entity !== "vehicles" || map.ownerEmail || map.ownerPhone || map.ownerName;
  const ready = rows.length > 0 && !missing.filter((m) => !(entity === "customers" && (m === "First name" || m === "Last name") && map.fullName)).length && nameOk && ownerOk;

  function run() {
    setError(null);
    setSummary(null);
    const mapped = rows.map((r) => Object.fromEntries(Object.entries(map).filter(([, src]) => src).map(([key, src]) => [key, r[src] ?? ""])));
    start(async () => {
      const total: ImportSummary = { created: 0, updated: 0, skipped: 0, errors: [] };
      const CHUNK = 200;
      setProgress({ done: 0, total: mapped.length });
      try {
        for (let i = 0; i < mapped.length; i += CHUNK) {
          const r = await importRows(entity, mapped.slice(i, i + CHUNK));
          total.created += r.created;
          total.updated += r.updated;
          total.skipped += r.skipped;
          total.errors.push(...r.errors.map((e) => e.replace(/^Row (\d+)/, (_, n) => `Row ${Number(n) + i}`)));
          setProgress({ done: Math.min(mapped.length, i + CHUNK), total: mapped.length });
        }
        setSummary(total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
      } finally {
        setProgress(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        {ENTITIES.map((e) => (
          <button key={e.key} type="button" onClick={() => switchEntity(e.key)} className={`card p-4 text-left hover:border-border-strong ${entity === e.key ? "border-accent" : ""}`}>
            <div className="font-medium">{e.label}</div>
            <div className="text-xs text-muted mt-1">{e.blurb}</div>
          </button>
        ))}
      </div>

      <div className="card p-5">
        <label className="flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer">
          <span className="btn btn-secondary w-fit"><FileUp size={15} /> Choose CSV file</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <span className="text-sm text-muted">{fileName ? `${fileName} — ${rows.length.toLocaleString()} rows, ${headers.length} columns` : "Export from your old system as CSV (Excel: Save As → CSV UTF-8)."}</span>
        </label>
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      </div>

      {headers.length ? (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
          <div className="card p-5">
            <div className="card-title mb-3">Match columns</div>
            <div className="space-y-2">
              {fields.map((f) => (
                <div key={f.key} className="grid grid-cols-[1fr_1fr] items-center gap-2">
                  <label className="text-sm">{f.label}{f.required ? <span className="text-red-400"> *</span> : null}{f.hint ? <div className="text-[11px] text-faint">{f.hint}</div> : null}</label>
                  <select value={map[f.key] ?? ""} onChange={(e) => setMap({ ...map, [f.key]: e.target.value })} className="select text-sm">
                    <option value="">— skip —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {!ready ? <p className="mt-3 text-xs text-amber-400">{!nameOk ? "Map a name column." : !ownerOk ? "Map an owner email, phone or name." : `Required: ${missing.join(", ")}`}</p> : null}
            <button type="button" onClick={run} disabled={!ready || pending} className="btn btn-primary mt-4 w-full">
              <Upload size={15} /> {pending ? (progress ? `Importing ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}…` : "Importing…") : `Import ${rows.length.toLocaleString()} ${entity}`}
            </button>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-border card-title">Preview (first 5 rows as they will import)</div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr>{fields.filter((f) => map[f.key]).map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => <tr key={i}>{fields.filter((f) => map[f.key]).map((f) => <td key={f.key} className="text-xs whitespace-nowrap max-w-[220px] truncate">{r[map[f.key]]}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="card p-5">
          <div className="flex flex-wrap gap-6 text-sm">
            <span><span className="text-2xl font-semibold text-emerald-400">{summary.created}</span> created</span>
            <span><span className="text-2xl font-semibold text-accent">{summary.updated}</span> updated</span>
            <span><span className={`text-2xl font-semibold ${summary.skipped ? "text-amber-400" : ""}`}>{summary.skipped}</span> skipped</span>
          </div>
          {summary.errors.length ? <ul className="mt-3 text-xs text-muted space-y-0.5 max-h-48 overflow-auto">{summary.errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : null}
        </div>
      ) : null}
    </div>
  );
}
