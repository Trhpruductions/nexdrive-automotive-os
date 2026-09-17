"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, Boxes, Gauge, Radio, Wifi, WifiOff } from "lucide-react";
import type { ProductionSnapshot } from "@/lib/integrations/snapshot";

const STATUS: Record<string, { label: string; dot: string; ring: string; text: string }> = {
  RUNNING: { label: "Running", dot: "bg-emerald-500", ring: "border-emerald-500/40", text: "text-emerald-400" },
  IDLE: { label: "Idle", dot: "bg-amber-400", ring: "border-amber-400/40", text: "text-amber-300" },
  DOWN: { label: "Down", dot: "bg-red-500", ring: "border-red-500/50", text: "text-red-400" },
  MAINTENANCE: { label: "Maintenance", dot: "bg-violet-500", ring: "border-violet-500/40", text: "text-violet-300" },
  OFFLINE: { label: "Offline", dot: "bg-slate-600", ring: "border-border", text: "text-faint" },
};

function ago(iso: string | null, now: number) {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function LiveFloor({ initial }: { initial: ProductionSnapshot }) {
  const [snap, setSnap] = useState(initial);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const es = new EventSource("/api/live");
    es.addEventListener("snapshot", (e) => {
      setSnap(JSON.parse((e as MessageEvent).data));
      setConnected(true);
    });
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      es.close();
      clearInterval(t);
    };
  }, []);

  const groups = [...snap.lines.map((l) => ({ line: l, machines: snap.machines.filter((m) => m.lineId === l.id) })), ...(snap.unassigned.length ? [{ line: null, machines: snap.unassigned }] : [])];

  return (
    <div className="space-y-4">
      {/* status strip */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${connected ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"}`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />} {connected ? "Live" : "Reconnecting…"}
        </span>
        <span className="text-muted">Updated {ago(snap.at, now)}</span>
        <span className="ml-auto flex flex-wrap gap-3">
          {(["RUNNING", "IDLE", "DOWN", "MAINTENANCE", "OFFLINE"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-muted"><span className={`h-2 w-2 rounded-full ${STATUS[s].dot}`} />{STATUS[s].label} <span className="text-text font-semibold tabular-nums">{snap.totals[s.toLowerCase() as "running"]}</span></span>
          ))}
        </span>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: "Produced today", value: snap.totals.producedToday.toLocaleString(), Icon: Boxes, cls: "text-accent bg-accent-soft" },
          { label: "Scrap today", value: snap.totals.scrapToday.toLocaleString(), Icon: AlertTriangle, cls: snap.totals.scrapToday ? "text-amber-400 bg-amber-500/15" : "text-muted bg-card-hover" },
          { label: "Machines running", value: `${snap.totals.running} / ${snap.totals.machines}`, Icon: Activity, cls: "text-emerald-400 bg-emerald-500/15" },
          { label: "Feeds online", value: `${snap.integrations.filter((i) => i.enabled && i.lastSeenAt && now - new Date(i.lastSeenAt).getTime() < 15 * 60_000).length} / ${snap.integrations.length}`, Icon: Radio, cls: "text-violet-400 bg-violet-500/15" },
        ].map((k) => (
          <div key={k.label} className="card p-4 flex items-center justify-between gap-3">
            <div><div className="card-title">{k.label}</div><div className="text-2xl font-semibold mt-1 tabular-nums">{k.value}</div></div>
            <span className={`h-10 w-10 rounded-xl grid place-items-center ${k.cls}`}><k.Icon size={20} /></span>
          </div>
        ))}
      </div>

      {/* lines */}
      {groups.length ? (
        groups.map(({ line, machines }) => (
          <section key={line?.id ?? "unassigned"} className="card p-4 sm:p-5">
            <header className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="font-semibold">{line ? line.name : "Unassigned machines"}</h2>
              {line?.description ? <span className="text-xs text-muted">{line.description}</span> : null}
              {line ? (
                <span className="ml-auto flex flex-wrap gap-4 text-xs text-muted">
                  <span>Today <span className="text-text font-semibold tabular-nums">{line.today.toLocaleString()}</span></span>
                  <span>Last hour <span className="text-text font-semibold tabular-nums">{line.lastHour}</span>{line.targetPerHour ? <span className="text-faint"> / {line.targetPerHour} target</span> : null}</span>
                  {line.rate != null ? <span className={line.rate >= 0.9 ? "text-emerald-400" : line.rate >= 0.6 ? "text-amber-400" : "text-red-400"}>{Math.round(line.rate * 100)}% of target</span> : null}
                  <span>{line.running}/{line.machines} running{line.down ? <span className="text-red-400"> · {line.down} down</span> : null}</span>
                </span>
              ) : null}
            </header>
            {line?.targetPerHour ? (
              <div className="h-1.5 rounded-full bg-border overflow-hidden mb-4"><div className={`h-full rounded-full ${line.rate != null && line.rate >= 0.9 ? "bg-emerald-500" : line.rate != null && line.rate >= 0.6 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${Math.min(100, Math.round((line.rate ?? 0) * 100))}%` }} /></div>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {machines.map((m) => {
                const st = STATUS[m.status] ?? STATUS.OFFLINE;
                const metrics = Object.entries(m.metrics ?? {}).slice(0, 4);
                return (
                  <Link key={m.id} href={`/production/${m.id}`} className={`rounded-xl border bg-bg-elevated p-3.5 hover:bg-card-hover transition-colors ${st.ring}`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${st.dot} ${m.status === "RUNNING" ? "animate-pulse" : ""}`} />
                      <span className="font-semibold truncate">{m.name}</span>
                      <span className="text-[10px] font-mono text-faint ml-auto">{m.code}</span>
                    </div>
                    <div className={`text-xs mt-1 ${st.text}`}>{st.label} <span className="text-faint">· since {ago(m.lastStatusChangeAt, now)}</span></div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      <div><div className="text-base font-semibold tabular-nums">{m.today.count.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-muted">today</div></div>
                      <div><div className="text-base font-semibold tabular-nums">{m.lastHour}</div><div className="text-[10px] uppercase tracking-wider text-muted">last hr</div></div>
                      <div><div className={`text-base font-semibold tabular-nums ${m.today.scrap ? "text-amber-400" : ""}`}>{m.today.scrap}</div><div className="text-[10px] uppercase tracking-wider text-muted">scrap</div></div>
                    </div>
                    {metrics.length ? (
                      <div className="mt-3 pt-2 border-t border-border grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        {metrics.map(([k, v]) => <div key={k} className="flex justify-between gap-2"><span className="text-muted truncate">{k.replace(/_/g, " ")}</span><span className="tabular-nums">{typeof v?.value === "number" ? Math.round(v.value * 100) / 100 : "—"}{v?.unit ? ` ${v.unit}` : ""}</span></div>)}
                      </div>
                    ) : null}
                    <div className="text-[10px] text-faint mt-2 flex items-center gap-1"><Gauge size={10} /> heartbeat {ago(m.lastHeartbeatAt, now)}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <div className="card p-10 text-center text-muted text-sm">No machines yet. Connect a feed under Settings → Integrations (or add a machine manually below) and they appear here the moment data arrives.</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="card p-5">
          <h2 className="card-title mb-3">Alarms (24h)</h2>
          <ul className="space-y-2 text-sm">
            {snap.alarms.map((a) => <li key={a.id} className="flex gap-2"><AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" /><span className="min-w-0"><span className="font-medium">{a.name}</span>{a.code ? <span className="text-xs text-faint font-mono"> {a.code}</span> : null}<span className="text-muted"> — {a.message}</span><div className="text-[11px] text-faint">{ago(a.at, now)}</div></span></li>)}
            {!snap.alarms.length ? <li className="text-muted">No alarms.</li> : null}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="card-title mb-3">Event stream</h2>
          <ul className="space-y-1.5 text-xs max-h-72 overflow-y-auto">
            {snap.recent.map((e) => (
              <li key={e.id} className="flex gap-2">
                <span className="text-faint tabular-nums shrink-0 w-14">{ago(e.at, now)}</span>
                <span className="font-mono text-accent shrink-0">{e.machine}</span>
                <span className="text-muted truncate">
                  {e.type === "STATUS" ? `→ ${e.status?.toLowerCase()}${e.message ? ` (${e.message})` : ""}` : e.type === "COUNT" ? `+${e.count} parts` : e.type === "READING" ? `${e.metric} = ${e.value}${e.unit ? ` ${e.unit}` : ""}` : `alarm: ${e.message}`}
                </span>
              </li>
            ))}
            {!snap.recent.length ? <li className="text-muted">Waiting for data…</li> : null}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="card-title mb-3">Inventory (latest changes)</h2>
          <ul className="space-y-2 text-sm">
            {snap.inventory.map((p) => <li key={p.id} className="flex items-center justify-between gap-2"><Link href={`/parts/${p.id}`} className="min-w-0 truncate hover:text-accent">{p.name} <span className="text-[10px] font-mono text-faint">{p.sku}</span></Link><span className={`tabular-nums font-semibold ${p.low ? "text-amber-400" : ""}`}>{p.quantityOnHand}</span></li>)}
          </ul>
          <div className="mt-3 pt-3 border-t border-border text-[11px] text-faint">
            Feeds: {snap.integrations.length ? snap.integrations.map((i) => <span key={i.id} className="mr-2"><span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${i.enabled && i.lastSeenAt && now - new Date(i.lastSeenAt).getTime() < 15 * 60_000 ? "bg-emerald-500" : i.lastError ? "bg-red-500" : "bg-slate-600"}`} />{i.name}</span>) : "none connected"}
          </div>
        </section>
      </div>
    </div>
  );
}
