import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, Calendar, Check, ClipboardCheck, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { requireStaff, can, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { deferredWork } from "@/lib/deferred";
import { DeferredWorkList } from "@/components/app/deferred-work";
import { Badge, Card, Flash, PageHeader, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { PhotoGrid } from "@/components/app/photo-grid";
import { addReminder, deleteReminder, deleteVehicle, toggleReminder } from "@/actions/vehicles";
import { INSPECTION_RESULT, WO_STATUS } from "@/lib/constants";
import { computeTotals } from "@/lib/money";
import { fmtDate, fmtDateTime, money, num, vehicleName, woNumber } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await db.vehicle.findUnique({ where: { id }, select: { year: true, make: true, model: true } });
  return { title: v ? vehicleName(v) : "Vehicle" };
}

export default async function VehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireStaff();
  const settings = await getSettings();
  const { id } = await params;
  const sp = await searchParams;
  const v = await db.vehicle.findUnique({
    where: { id },
    include: {
      customer: true,
      workOrders: { orderBy: { createdAt: "desc" }, include: { lines: true, technician: true, invoice: true } },
      photos: { orderBy: { createdAt: "desc" } },
      inspections: { orderBy: { createdAt: "desc" }, take: 5, include: { items: true, workOrder: { select: { number: true } } } },
      reminders: { orderBy: [{ completed: "asc" }, { dueAtDate: "asc" }] },
      appointments: { where: { scheduledStart: { gte: new Date() } }, orderBy: { scheduledStart: "asc" }, take: 3 },
    },
  });
  if (!v) notFound();

  const spent = v.workOrders.filter((w) => w.invoice).reduce((s, w) => s + Number(w.invoice!.amountPaid), 0);
  const open = v.workOrders.find((w) => !["INVOICED", "CANCELLED"].includes(w.status));
  const deferred = await deferredWork(v.id, open?.id);
  const { terms } = settings;

  return (
    <div>
      <PageHeader
        title={vehicleName(v)}
        subtitle={<>{[v.color, v.licensePlate ? `${v.licensePlate}${v.plateState ? ` (${v.plateState})` : ""}` : null].filter(Boolean).join(" · ")} · Owner: <Link href={`/customers/${v.customer.id}`} className="text-accent hover:underline">{v.customer.firstName} {v.customer.lastName}</Link></>}
        crumbs={[{ label: terms.assets, href: "/vehicles" }, { label: vehicleName(v) }]}
        actions={
          <>
            <Link href={`/schedule/new?vehicleId=${v.id}`} className="btn btn-secondary"><Calendar size={16} /> Book</Link>
            <Link href={`/work-orders/new?vehicleId=${v.id}`} className="btn btn-secondary"><Plus size={16} /> Work order</Link>
            <Link href={`/vehicles/${v.id}/edit`} className="btn btn-primary"><Pencil size={16} /> Edit</Link>
          </>
        }
      />
      <Flash searchParams={sp} />
      {open ? (
        <div className="mb-4 rounded-lg border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm flex items-center justify-between gap-3">
          <span>Currently in shop — <Link href={`/work-orders/${open.id}`} className="font-semibold text-accent hover:underline">{woNumber(open.number)}</Link>: {open.complaint}</span>
          <Badge tone={WO_STATUS[open.status].tone}>{WO_STATUS[open.status].label}</Badge>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card title={`${terms.asset} details`}>
            <div className="grid grid-cols-2 gap-4">
              <Stat label={terms.serial} value={<span className="font-mono text-xs break-all">{v.vin ?? "—"}</span>} />
              {terms.odometer ? <Stat label={terms.odometer} value={`${num(v.mileage)} ${terms.odometerUnit}`} /> : null}
              {terms.engine ? <Stat label={terms.engine} value={v.engine ?? "—"} /> : null}
              {terms.transmission ? <Stat label={terms.transmission} value={v.transmission ?? "—"} /> : null}
              <Stat label="Trim" value={v.trim ?? "—"} />
              <Stat label="Color" value={v.color ?? "—"} />
              <Stat label="Visits" value={v.workOrders.length} />
              <Stat label="Total spent" value={money(spent)} />
            </div>
            {v.notes ? <p className="text-sm text-muted whitespace-pre-line border-t border-border pt-3 mt-4">{v.notes}</p> : null}
          </Card>

          <Card title="Deferred & recommended work" action={deferred.length ? <span className="text-xs text-amber-400">{deferred.length} item{deferred.length === 1 ? "" : "s"}</span> : null}>
            <DeferredWorkList items={deferred} vehicleId={v.id} targetWorkOrderId={open?.id} returnTo={`/vehicles/${v.id}?ok=Added+to+${open ? encodeURIComponent(`WO-${String(open.number).padStart(5, "0")}`) : ""}`} />
          </Card>

          <Card title="Upcoming maintenance">
            {v.reminders.length ? (
              <ul className="space-y-2 mb-4">
                {v.reminders.map((r) => {
                  const overdue = !r.completed && ((r.dueAtDate && r.dueAtDate < new Date()) || (r.dueAtMileage && r.dueAtMileage <= v.mileage));
                  return (
                    <li key={r.id} className={`flex items-center gap-2 text-sm ${r.completed ? "opacity-50 line-through" : ""}`}>
                      <form action={toggleReminder.bind(null, r.id, v.id)}>
                        <button className={`h-5 w-5 rounded border grid place-items-center ${r.completed ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "border-border-strong text-transparent hover:text-muted"}`} aria-label="Toggle">
                          {r.completed ? <Check size={12} /> : <Undo2 size={10} />}
                        </button>
                      </form>
                      <span className="flex-1">{r.service}</span>
                      <span className={`text-xs ${overdue ? "text-red-400 font-semibold" : "text-muted"}`}>
                        {overdue ? "Overdue · " : ""}{[r.dueAtMileage ? `${num(r.dueAtMileage)} mi` : null, r.dueAtDate ? fmtDate(r.dueAtDate) : null].filter(Boolean).join(" / ")}
                      </span>
                      <form action={deleteReminder.bind(null, r.id, v.id)}><button className="text-faint hover:text-red-400" aria-label="Delete"><Trash2 size={13} /></button></form>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted mb-4">No reminders set.</p>
            )}
            <form action={addReminder.bind(null, v.id)} className="grid grid-cols-2 gap-2 border-t border-border pt-4">
              <input name="service" placeholder="Service (e.g. Oil change)" required className="input col-span-2" />
              <input name="dueAtMileage" type="number" placeholder="Due at miles" className="input" />
              <input name="dueAtDate" type="date" className="input" />
              <button className="btn btn-secondary btn-sm col-span-2"><Bell size={14} /> Add reminder</button>
            </form>
          </Card>

          {can(user, MANAGER_ROLES) ? (
            <form action={deleteVehicle.bind(null, v.id)} className="text-right">
              <ConfirmButton message={`Delete this ${terms.asset.toLowerCase()}?`}><Trash2 size={14} /> Delete {terms.asset.toLowerCase()}</ConfirmButton>
            </form>
          ) : null}
        </div>

        <div className="xl:col-span-2 space-y-4">
          <Card title="Service history" padded={false}>
            {v.workOrders.length ? (
              <table className="table">
                <thead><tr><th>Work order</th><th>Technician</th><th>Status</th><th>Date</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {v.workOrders.map((w) => {
                    const t = computeTotals(w.lines, settings.taxRate, { taxExempt: v.customer.taxExempt });
                    return (
                      <tr key={w.id} className="row-link">
                        <td><Link href={`/work-orders/${w.id}`} className="font-medium hover:text-accent">{woNumber(w.number)}</Link><div className="text-xs text-muted truncate max-w-[260px]">{w.complaint}</div></td>
                        <td className="text-muted text-xs">{w.technician?.name ?? "—"}</td>
                        <td><Badge tone={WO_STATUS[w.status].tone}>{WO_STATUS[w.status].label}</Badge></td>
                        <td className="text-muted text-xs">{fmtDate(w.createdAt)}{w.mileageIn ? <div className="text-faint">{num(w.mileageIn)} mi</div> : null}</td>
                        <td className="text-right tabular-nums">{money(t.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted p-5">No service history yet.</p>
            )}
          </Card>

          <Card title="Photos">
            <PhotoGrid photos={v.photos} vehicleId={v.id} returnTo={`/vehicles/${v.id}`} />
          </Card>

          <Card title="Inspection reports">
            {v.inspections.length ? (
              <ul className="space-y-3">
                {v.inspections.map((i) => {
                  const counts = { GOOD: 0, ATTENTION: 0, URGENT: 0, NA: 0 };
                  for (const it of i.items) counts[it.result]++;
                  return (
                    <li key={i.id}>
                      <Link href={`/inspections/${i.id}`} className="card card-hover p-3 flex items-center gap-3 transition-colors">
                        <span className="h-9 w-9 rounded-lg bg-accent-soft text-accent grid place-items-center"><ClipboardCheck size={16} /></span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{woNumber(i.workOrder.number)} · {fmtDateTime(i.createdAt)}</div>
                          <div className="text-xs text-muted truncate">{i.summary ?? `${i.items.length} points checked`}</div>
                        </div>
                        <div className="flex gap-1.5">
                          {(["GOOD", "ATTENTION", "URGENT"] as const).map((k) => (
                            <span key={k} className="flex items-center gap-1 text-xs text-muted"><span className={`h-2 w-2 rounded-full ${INSPECTION_RESULT[k].dot}`} />{counts[k]}</span>
                          ))}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">No inspections yet. Inspections are started from a work order.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
