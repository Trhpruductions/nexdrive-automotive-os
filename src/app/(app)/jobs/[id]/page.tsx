import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Pause, Play, Save, ShieldAlert, Truck, XCircle } from "lucide-react";
import { differenceInMinutes } from "date-fns";
import { requireStaff, can, BILLING_ROLES, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, Field, Flash, PageHeader, Progress, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { addCounts, cancelJob, finishJob, pauseJob, startJob, updateJob } from "@/actions/production";
import { logScrap, releaseHold, setJobLot } from "@/actions/quality";
import { QC_KIND, qualityStatus, SCRAP_REASONS, type Measurement } from "@/lib/quality";
import { fmtDate, fmtDateTime, fmtTime, money, num, toDateInput } from "@/lib/format";
import { jobNumber } from "@/lib/production";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const j = await db.productionJob.findUnique({ where: { id }, select: { number: true } });
  return { title: j ? jobNumber(j.number) : "Job" };
}

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const [j, presses, dies] = await Promise.all([
    db.productionJob.findUnique({ where: { id }, include: { part: { include: { material: { select: { id: true, name: true, unit: true, quantityOnHand: true } } } }, customer: true, machine: true, die: true, lot: true, runs: { orderBy: { startedAt: "desc" }, include: { technician: { select: { name: true } }, lot: { select: { lotNumber: true } } } }, shipmentLines: { include: { shipment: { select: { id: true, number: true, status: true, shipDate: true } } } }, checks: { orderBy: { checkedAt: "desc" }, take: 30 }, scrapEntries: { orderBy: { at: "desc" }, take: 50 } } }),
    db.machine.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, status: true } }),
    db.die.findMany({ where: { status: { not: "RETIRED" } }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  if (!j) notFound();
  const [q, lots] = await Promise.all([
    qualityStatus(id),
    j.part.material ? db.materialLot.findMany({ where: { partId: j.part.material.id, OR: [{ remaining: { gt: 0 } }, { id: j.lotId ?? "" }] }, orderBy: { receivedAt: "asc" } }) : Promise.resolve([]),
  ]);
  const scrapByReason = Object.entries(j.scrapEntries.reduce<Record<string, number>>((acc, e) => { acc[e.reason] = (acc[e.reason] ?? 0) + e.quantity; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const classified = j.scrapEntries.reduce((s, e) => s + e.quantity, 0);
  const open = !["COMPLETE", "CANCELLED"].includes(j.status);
  const pct = j.quantity ? Math.min(1, j.good / j.quantity) : 0;
  const total = j.good + j.scrap;
  const scrapPct = total ? (j.scrap / total) * 100 : 0;
  const runMin = j.runs.reduce((s, r) => s + differenceInMinutes(r.endedAt ?? new Date(), r.startedAt), 0);
  const rate = runMin > 0 ? total / (runMin / 60) : null;
  const remaining = Math.max(0, j.quantity - j.good);
  const eta = rate && remaining ? remaining / rate : null;
  const perPiece = j.part.materialPerPiece ? Number(j.part.materialPerPiece) : null;
  const tone = j.status === "RUNNING" ? "green" : j.status === "PAUSED" ? "amber" : j.status === "COMPLETE" ? "violet" : j.status === "CANCELLED" ? "red" : "blue";

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3">{jobNumber(j.number)} <Badge tone={tone}>{j.status.toLowerCase()}</Badge></span>}
        subtitle={<>{j.part.sku} — {j.part.name} · <Link href={`/customers/${j.customerId}`} className="text-accent hover:underline">{j.customer.company ?? `${j.customer.firstName} ${j.customer.lastName}`}</Link>{j.customerPo ? ` · PO ${j.customerPo}` : ""}{j.dueAt ? ` · due ${fmtDate(j.dueAt)}` : ""}</>}
        crumbs={[{ label: "Jobs", href: "/jobs" }, { label: jobNumber(j.number) }]}
        actions={
          <>
            {open && j.status !== "RUNNING" ? (
              <form action={startJob.bind(null, j.id)} className="flex items-center gap-2">
                <select name="machineId" defaultValue={j.machineId ?? ""} className="select py-2 w-44"><option value="">Press…</option>{presses.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.status.toLowerCase()}</option>)}</select>
                <button className="btn btn-primary"><Play size={15} /> {j.status === "PAUSED" ? "Resume" : "Start"}</button>
              </form>
            ) : null}
            {j.status === "RUNNING" ? <form action={pauseJob.bind(null, j.id)}><input type="hidden" name="reason" value="" /><button className="btn btn-secondary"><Pause size={15} /> Pause</button></form> : null}
            {open ? <form action={finishJob.bind(null, j.id)}><ConfirmButton message={`Complete ${jobNumber(j.number)}? ${num(j.good)} good pieces go into finished stock${perPiece && j.part.material ? " and material is consumed" : ""}.`} className="btn btn-secondary"><CheckCircle2 size={15} /> Complete</ConfirmButton></form> : null}
            {j.status === "COMPLETE" && j.good - j.shipped > 0 ? <Link href={`/shipments/new?jobId=${j.id}`} className="btn btn-primary"><Truck size={15} /> Ship {num(j.good - j.shipped)}</Link> : null}
          </>
        }
      />
      <Flash searchParams={sp} />
      {j.onHold ? (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 flex flex-wrap items-center gap-3">
          <ShieldAlert size={18} className="text-red-400 shrink-0" />
          <div className="flex-1 min-w-[200px] text-sm"><strong>Quality hold</strong> — {j.holdReason ?? "check failed"}. The press won&apos;t restart until a check passes{can(user, MANAGER_ROLES) ? " or a manager releases it" : ""}.</div>
          <Link href={`/jobs/${j.id}/check`} className="btn btn-primary btn-sm"><ClipboardCheck size={14} /> Re-check</Link>
          {can(user, MANAGER_ROLES) ? <form action={releaseHold.bind(null, j.id)} className="flex gap-2"><input name="note" className="input py-1.5 w-52" placeholder="Why it is OK to run…" /><ConfirmButton message="Release the hold without a passing check?" className="btn btn-secondary btn-sm">Release</ConfirmButton></form> : null}
        </div>
      ) : q.firstPiece === "needed" && (j.status === "RUNNING" || j.status === "PAUSED" || j.status === "RELEASED") ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
          <ClipboardCheck size={18} className="text-amber-400 shrink-0" />
          <div className="flex-1 min-w-[200px]"><strong>First piece not approved.</strong> Measure the first part off the die before running the order.</div>
          <Link href={`/jobs/${j.id}/check?kind=FIRST_PIECE`} className="btn btn-primary btn-sm">First piece check</Link>
        </div>
      ) : q.inProcessDue ? (
        <div className="mb-4 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
          <ClipboardCheck size={18} className="text-blue-400 shrink-0" />
          <div className="flex-1 min-w-[200px]"><strong>In-process check due</strong> — every {num(j.part.checkEveryPieces ?? 0)} pieces; {num(j.good)} made.</div>
          <Link href={`/jobs/${j.id}/check?kind=IN_PROCESS`} className="btn btn-primary btn-sm">Check now</Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-4">
        <div className="card p-4 xl:col-span-2"><div className="card-title mb-2">Progress</div><Progress value={pct} tone={pct >= 1 ? "green" : "blue"} /><div className="text-sm mt-2 tabular-nums">{num(j.good)} of {num(j.quantity)} good · {remaining ? `${num(remaining)} to go` : "done"}{eta ? ` · ~${eta < 1 ? `${Math.round(eta * 60)} min` : `${eta.toFixed(1)} h`} at current rate` : ""}</div></div>
        <Stat label="Scrap" value={`${num(j.scrap)} (${scrapPct.toFixed(1)}%)`} sub={scrapPct > 3 ? "above 3% — check die & material" : undefined} />
        <Stat label="Rate" value={rate ? `${Math.round(rate)}/h` : "—"} sub={j.part.stdRatePerHour ? `std ${j.part.stdRatePerHour}/h` : undefined} />
        <Stat label="Run time" value={`${(runMin / 60).toFixed(1)} h`} sub={`${j.runs.length} run${j.runs.length === 1 ? "" : "s"}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          {j.status === "RUNNING" || j.status === "PAUSED" ? (
            <Card title="Counts" action={<span className="text-xs text-muted">{j.machine ? `Live counts from ${j.machine.code} land here automatically` : "No press assigned"}</span>}>
              <form action={addCounts.bind(null, j.id)} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
                <Field label="Good pieces"><input name="good" type="number" min={0} defaultValue={0} className="input" /></Field>
                <Field label="Scrap"><input name="scrap" type="number" min={0} defaultValue={0} className="input" /></Field>
                <Field label="Downtime (min)"><input name="downtime" type="number" min={0} defaultValue={0} className="input" /></Field>
                <Field label="Downtime reason"><input name="reason" className="input" placeholder="Die change, coil change…" /></Field>
                <button className="btn btn-secondary"><Save size={14} /> Add</button>
                <Field label="Scrap reason" className="col-span-2 sm:col-span-5"><select name="scrapReason" defaultValue="" className="select"><option value="">— unclassified —</option>{SCRAP_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
              </form>
            </Card>
          ) : null}

          <Card title="Runs" padded={false}>
            <table className="table">
              <thead><tr><th>Started</th><th>Shift</th><th>Press / die</th><th>Coil</th><th>Operator</th><th className="text-right">Good</th><th className="text-right">Scrap</th><th className="text-right">Downtime</th><th>Note</th></tr></thead>
              <tbody>
                {j.runs.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs whitespace-nowrap">{fmtDateTime(r.startedAt)}{r.endedAt ? <span className="text-muted"> → {fmtTime(r.endedAt)}</span> : <Badge tone="green" className="ml-2">live</Badge>}</td>
                    <td className="text-xs text-muted">{r.shift ?? "—"}</td>
                    <td className="text-xs text-muted">{presses.find((p) => p.id === r.machineId)?.code ?? "—"}{r.dieId ? ` · ${dies.find((d) => d.id === r.dieId)?.code ?? ""}` : ""}</td>
                    <td className="text-xs font-mono text-muted">{r.lot?.lotNumber ?? "—"}</td>
                    <td className="text-xs">{r.technician?.name ?? r.operator ?? "—"}</td>
                    <td className="text-right tabular-nums">{num(r.good)}</td>
                    <td className="text-right tabular-nums text-muted">{r.scrap}</td>
                    <td className="text-right tabular-nums text-muted">{r.downtimeMinutes ? `${r.downtimeMinutes} min` : "—"}</td>
                    <td className="text-xs text-muted max-w-[200px] truncate">{r.downtimeReason ?? r.notes}</td>
                  </tr>
                ))}
                {!j.runs.length ? <tr><td colSpan={9} className="text-center text-muted py-6">Not started yet.</td></tr> : null}
              </tbody>
            </table>
          </Card>

          <Card title="Quality" padded={false} action={<span className="flex gap-1.5">{open ? <><Link href={`/jobs/${j.id}/check?kind=FIRST_PIECE`} className="btn btn-ghost btn-sm">First piece</Link><Link href={`/jobs/${j.id}/check?kind=IN_PROCESS`} className="btn btn-ghost btn-sm">In-process</Link><Link href={`/jobs/${j.id}/check?kind=FINAL`} className="btn btn-secondary btn-sm"><ClipboardCheck size={13} /> Final</Link></> : null}</span>}>
            <div className="px-5 py-3 border-b border-border text-xs text-muted flex flex-wrap gap-x-4 gap-y-1">
              <span>First piece: {q.firstPiece === "approved" ? <Badge tone="green">approved {j.firstPieceAt ? fmtDateTime(j.firstPieceAt) : ""}</Badge> : q.firstPiece === "failed" ? <Badge tone="red">failed</Badge> : q.firstPiece === "needed" ? <Badge tone="amber">needed</Badge> : <Badge tone="slate">not required</Badge>}</span>
              {j.part.checkEveryPieces ? <span>In-process every {num(j.part.checkEveryPieces)} pcs{q.nextCheckAt != null && open ? ` · next at ${num(q.nextCheckAt)}` : ""}</span> : null}
              {q.plan.length ? <span>{q.plan.length} feature{q.plan.length === 1 ? "" : "s"} on the check plan{j.part.drawingRev ? ` · rev ${j.part.drawingRev}` : ""}</span> : <span>No check plan — <Link href={`/parts/products/${j.partId}`} className="text-accent">add one on the product</Link></span>}
            </div>
            <table className="table">
              <thead><tr><th>When</th><th>Check</th><th className="text-right">At pcs</th><th>Result</th><th>Inspector</th><th>Detail</th></tr></thead>
              <tbody>
                {j.checks.map((c) => {
                  const ms = c.measurements as unknown as Measurement[];
                  const bad = ms.filter((m) => !m.ok);
                  return (
                    <tr key={c.id}>
                      <td className="text-xs whitespace-nowrap">{fmtDateTime(c.checkedAt)}</td>
                      <td className="text-sm">{QC_KIND[c.kind]}</td>
                      <td className="text-right tabular-nums">{num(c.pieceCount)}</td>
                      <td><Badge tone={c.result === "PASS" ? "green" : "red"}>{c.result.toLowerCase()}</Badge></td>
                      <td className="text-xs">{c.inspector ?? "—"}</td>
                      <td className="text-xs text-muted max-w-[260px] truncate">{bad.length ? `Out: ${bad.map((m) => `${m.name}${m.actual != null ? ` ${m.actual}` : ""}`).join(", ")}` : ms.length ? `${ms.length}/${ms.length} in tolerance` : ""}{c.notes ? ` · ${c.notes}` : ""}</td>
                    </tr>
                  );
                })}
                {!j.checks.length ? <tr><td colSpan={6} className="text-center text-muted py-6">No checks recorded.</td></tr> : null}
              </tbody>
            </table>
          </Card>

          <Card title={`Scrap · ${num(j.scrap)} pcs`} padded={false} action={j.scrap > classified ? <span className="text-xs text-muted">{num(j.scrap - classified)} unclassified</span> : null}>
            {scrapByReason.length ? (
              <ul className="px-5 py-3 space-y-1.5 border-b border-border">
                {scrapByReason.map(([reason, qty]) => (
                  <li key={reason} className="flex items-center gap-3 text-sm"><span className="w-40 truncate">{reason}</span><Progress value={qty / Math.max(1, j.scrap)} tone="amber" className="flex-1" /><span className="w-12 text-right tabular-nums text-muted">{num(qty)}</span></li>
                ))}
              </ul>
            ) : null}
            {open ? (
              <form action={logScrap.bind(null, j.id)} className="p-5 grid grid-cols-[6rem_1fr_1fr_auto] gap-2 items-end">
                <Field label="Pieces"><input name="quantity" type="number" min={1} className="input" /></Field>
                <Field label="Reason"><select name="reason" className="select" defaultValue={SCRAP_REASONS[0]}>{SCRAP_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
                <Field label="Notes"><input name="notes" className="input" placeholder="Where on the strip, what changed…" /></Field>
                <button className="btn btn-secondary">Log scrap</button>
              </form>
            ) : !scrapByReason.length ? <p className="px-5 py-6 text-center text-sm text-muted">No scrap logged with a reason.</p> : null}
          </Card>

          {j.shipmentLines.length ? (
            <Card title="Shipped" padded={false}>
              <ul className="divide-y divide-border">{j.shipmentLines.map((l) => <li key={l.id} className="px-5 py-2.5 text-sm flex justify-between"><Link href={`/shipments/${l.shipment.id}`} className="hover:text-accent">SH-{String(l.shipment.number).padStart(5, "0")} · {l.shipment.status.toLowerCase()}{l.shipment.shipDate ? ` · ${fmtDate(l.shipment.shipDate)}` : ""}</Link><span className="tabular-nums">{num(l.quantity)} pcs</span></li>)}</ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card title="Material">
            {j.part.material ? (
              <div className="text-sm space-y-1">
                <div>{j.part.material.name} <span className="text-muted">· {num(j.part.material.quantityOnHand)} {j.part.material.unit} on hand</span></div>
                {perPiece ? <div className="text-muted">{perPiece} {j.part.material.unit}/pc · needs ≈ {num(Math.round(perPiece * j.quantity))} {j.part.material.unit} for the order{j.materialUsed ? ` · used ${num(Math.round(Number(j.materialUsed)))}` : ""}</div> : null}
              </div>
            ) : <p className="text-sm text-muted">No material set on the product.</p>}
            {j.part.material ? (
              <form action={setJobLot.bind(null, j.id)} className="mt-3 pt-3 border-t border-border">
                <div className="label mb-1">Coil / lot on the press</div>
                <div className="flex gap-2">
                  <select name="lotId" defaultValue={j.lotId ?? ""} className="select flex-1" disabled={!open}>
                    <option value="">— none —</option>
                    {lots.map((l) => <option key={l.id} value={l.id}>{l.lotNumber}{l.heatNumber ? ` / heat ${l.heatNumber}` : ""} · {num(Math.round(Number(l.remaining)))} {l.unit} left</option>)}
                  </select>
                  {open ? <button className="btn btn-secondary btn-sm shrink-0">{j.status === "RUNNING" ? "Change coil" : "Set"}</button> : null}
                </div>
                {!lots.length ? <p className="text-xs text-muted mt-1">No lots on file — <Link href="/parts/lots" className="text-accent">receive a coil</Link> to trace heat numbers.</p> : j.lot ? <p className="text-xs text-muted mt-1">Running on <Link href={`/parts/lots/${j.lot.id}`} className="text-accent">{j.lot.lotNumber}</Link>{j.lot.heatNumber ? ` · heat ${j.lot.heatNumber}` : ""}{j.lot.supplier ? ` · ${j.lot.supplier}` : ""}{j.lot.certOnFile ? " · cert on file" : ""}</p> : null}
              </form>
            ) : null}
            <div className="mt-3 pt-3 border-t border-border text-sm">
              <div className="flex justify-between"><span className="text-muted">Sell price</span><span className="tabular-nums">{money(j.part.price)} / {j.part.unit}</span></div>
              <div className="flex justify-between"><span className="text-muted">Order value</span><span className="tabular-nums font-medium">{money(Number(j.part.price) * j.quantity)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Shipped</span><span className="tabular-nums">{num(j.shipped)} / {num(j.good)}</span></div>
            </div>
          </Card>

          {can(user, BILLING_ROLES) ? (
            <Card title="Job details">
              <form action={updateJob.bind(null, j.id)} className="space-y-3">
                <Field label="Quantity"><input name="quantity" type="number" min={1} defaultValue={j.quantity} className="input" disabled={!open} /></Field>
                <Field label="Customer PO"><input name="customerPo" defaultValue={j.customerPo ?? ""} className="input" /></Field>
                <Field label="Due"><input name="dueAt" type="date" defaultValue={toDateInput(j.dueAt)} className="input" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Press"><select name="machineId" defaultValue={j.machineId ?? ""} className="select" disabled={j.status === "RUNNING"}><option value="">—</option>{presses.map((m) => <option key={m.id} value={m.id}>{m.code}</option>)}</select></Field>
                  <Field label="Die"><select name="dieId" defaultValue={j.dieId ?? ""} className="select"><option value="">—</option>{dies.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select></Field>
                </div>
                <Field label="Priority"><input name="priority" type="number" defaultValue={j.priority} className="input" /></Field>
                <Field label="Notes"><textarea name="notes" rows={3} defaultValue={j.notes ?? ""} className="textarea" /></Field>
                <button className="btn btn-primary btn-sm"><Save size={14} /> Save</button>
              </form>
              {open && j.status !== "RUNNING" ? <form action={cancelJob.bind(null, j.id)} className="mt-3 text-right"><ConfirmButton message="Cancel this job?" className="btn btn-ghost btn-sm text-red-400"><XCircle size={13} /> Cancel job</ConfirmButton></form> : null}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
