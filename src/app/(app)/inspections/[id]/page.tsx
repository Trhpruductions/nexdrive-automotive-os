import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCheck, Plus, Printer, Save, Trash2 } from "lucide-react";
import { requireStaff, can, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, Flash, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { PhotoGrid } from "@/components/app/photo-grid";
import { addInspectionItem, deleteInspection, markAllGood, saveInspectionSummary, setInspectionItem, setInspectionItemNote } from "@/actions/inspections";
import { INSPECTION_RESULT } from "@/lib/constants";
import { fmtDateTime, vehicleName, woNumber } from "@/lib/format";
import { CarDiagram } from "./car-diagram";

const RESULTS = ["GOOD", "ATTENTION", "URGENT", "NA"] as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const i = await db.inspection.findUnique({ where: { id }, select: { vehicle: { select: { year: true, make: true, model: true } } } });
  return { title: i ? `Inspection · ${vehicleName(i.vehicle)}` : "Inspection" };
}

export default async function InspectionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cat?: string; ok?: string; error?: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const [insp, technicians] = await Promise.all([
    db.inspection.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        vehicle: { include: { photos: { where: { OR: [{ kind: "INSPECTION" }, { workOrder: { inspection: { id } } }] }, orderBy: { createdAt: "desc" } } } },
        technician: true,
        workOrder: { include: { customer: true } },
      },
    }),
    db.technician.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!insp) notFound();

  const categories = [...new Set(insp.items.map((i) => i.category))];
  const current = sp.cat && categories.includes(sp.cat) ? sp.cat : categories[0];
  const items = insp.items.filter((i) => i.category === current);
  const counts = { GOOD: 0, ATTENTION: 0, URGENT: 0, NA: 0 };
  for (const it of insp.items) counts[it.result]++;
  const categoryTone = (cat: string) => {
    const its = insp.items.filter((i) => i.category === cat);
    if (its.some((i) => i.result === "URGENT")) return "bg-red-500";
    if (its.some((i) => i.result === "ATTENTION")) return "bg-amber-400";
    if (its.every((i) => i.result === "GOOD")) return "bg-emerald-500";
    return "bg-slate-600";
  };

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3"><Link href={`/work-orders/${insp.workOrderId}`} className="btn btn-ghost btn-sm -ml-2"><ArrowLeft size={16} /></Link> Vehicle Inspection</span>}
        subtitle={<>{vehicleName(insp.vehicle)} · {woNumber(insp.workOrder.number)} · {insp.workOrder.customer.firstName} {insp.workOrder.customer.lastName} · started {fmtDateTime(insp.createdAt)}</>}
        actions={
          <>
            <form action={markAllGood.bind(null, insp.id)}><button className="btn btn-secondary"><CheckCheck size={15} /> Mark unchecked as good</button></form>
            <Link href={`/inspections/${insp.id}/print`} className="btn btn-secondary"><Printer size={15} /> Print report</Link>
            <Link href={`/work-orders/${insp.workOrderId}`} className="btn btn-primary">Back to work order</Link>
          </>
        }
      />
      <Flash searchParams={sp} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card padded={false}>
            {/* category tabs */}
            <div className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-3">
              {categories.map((cat) => (
                <Link key={cat} href={`/inspections/${insp.id}?cat=${encodeURIComponent(cat)}`} className={`shrink-0 flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${cat === current ? "border-accent text-text" : "border-transparent text-muted hover:text-text"}`}>
                  <span className={`h-2 w-2 rounded-full ${categoryTone(cat)}`} />
                  {cat}
                </Link>
              ))}
            </div>
            <ul className="divide-y divide-border">
              {items.map((it) => {
                const r = INSPECTION_RESULT[it.result];
                return (
                  <li key={it.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`h-3 w-3 rounded-full ${r.dot} shrink-0`} />
                      <span className="font-medium flex-1 min-w-[140px]">{it.name}</span>
                      <div className="flex gap-1">
                        {RESULTS.map((res) => (
                          <form key={res} action={setInspectionItem.bind(null, it.id, res)}>
                            <button
                              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold border transition-colors ${
                                it.result === res
                                  ? res === "GOOD" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : res === "ATTENTION" ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : res === "URGENT" ? "bg-red-500/20 border-red-500/50 text-red-300" : "bg-slate-500/20 border-slate-500/50 text-slate-300"
                                  : "border-border text-muted hover:text-text hover:border-border-strong"
                              }`}
                            >
                              {res === "NA" ? "N/A" : res === "ATTENTION" ? "Attention" : res[0] + res.slice(1).toLowerCase()}
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>
                    <form action={setInspectionItemNote.bind(null, it.id)} className="mt-2 flex gap-2 pl-6">
                      <input name="notes" defaultValue={it.notes ?? ""} placeholder="Measurement / notes (e.g. 3/32 tread, pads at 2mm)" className="input py-1.5 text-xs" />
                      <button className="btn btn-ghost btn-sm" title="Save note"><Save size={13} /></button>
                    </form>
                  </li>
                );
              })}
            </ul>
            <form action={addInspectionItem.bind(null, insp.id)} className="flex gap-2 p-3 border-t border-border">
              <input type="hidden" name="category" value={current} />
              <input name="name" placeholder={`Add item to ${current}…`} className="input py-1.5 text-sm" required />
              <button className="btn btn-secondary btn-sm"><Plus size={14} /> Add</button>
            </form>
          </Card>

          <Card title="Inspection photos">
            <PhotoGrid photos={insp.vehicle.photos} vehicleId={insp.vehicleId} workOrderId={insp.workOrderId} returnTo={`/inspections/${insp.id}?cat=${encodeURIComponent(current ?? "")}`} compact />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Overview">
            <CarDiagram items={insp.items} />
            <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
              {RESULTS.map((k) => (
                <div key={k} className="flex items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${INSPECTION_RESULT[k].dot}`} />
                  <span className="text-muted flex-1">{INSPECTION_RESULT[k].label}</span>
                  <span className="font-semibold tabular-nums">{counts[k]}</span>
                </div>
              ))}
            </div>
            <ul className="mt-4 space-y-1.5 text-xs">
              {insp.items.filter((i) => i.result === "URGENT" || i.result === "ATTENTION").map((i) => (
                <li key={i.id} className="flex items-start gap-2">
                  <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${INSPECTION_RESULT[i.result].dot}`} />
                  <span><span className="font-medium">{i.name}</span>{i.notes ? <span className="text-muted"> — {i.notes}</span> : null}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Summary">
            <form action={saveInspectionSummary.bind(null, insp.id)} className="space-y-3">
              <label className="block">
                <span className="label">Technician</span>
                <select name="technicianId" defaultValue={insp.technicianId ?? ""} className="select">
                  <option value="">—</option>
                  {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label">Summary for customer</span>
                <textarea name="summary" rows={4} defaultValue={insp.summary ?? ""} className="textarea" placeholder="Overall condition and recommendations" />
              </label>
              <button className="btn btn-primary w-full"><Save size={15} /> Save summary</button>
            </form>
            {can(user, BILLING_ROLES) ? (
              <form action={deleteInspection.bind(null, insp.id)} className="mt-3 text-right">
                <ConfirmButton message="Delete this inspection?" className="btn btn-ghost btn-sm text-red-400"><Trash2 size={13} /> Delete inspection</ConfirmButton>
              </form>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
