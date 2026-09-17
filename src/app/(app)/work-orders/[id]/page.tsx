import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ClipboardCheck, ExternalLink, FileText, Pause, Play, Receipt, Save, Send, Trash2, Undo2, XCircle } from "lucide-react";
import { requireStaff, can, BILLING_ROLES, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Avatar, Badge, Card, Field, Flash, PageHeader, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { PhotoGrid } from "@/components/app/photo-grid";
import { LinesEditor } from "./lines";
import { createInvoice, deleteWorkOrder, sendForApproval, setWorkOrderStatus, updateWorkOrderDetails } from "@/actions/workorders";
import { startInspection } from "@/actions/inspections";
import { INSPECTION_RESULT, WO_STATUS } from "@/lib/constants";
import { fmtDateTime, fmtRelative, invNumber, num, toLocalInput, vehicleName, woNumber } from "@/lib/format";
import { differenceInMinutes } from "date-fns";
import type { WorkOrderStatus } from "@/generated/prisma/enums";

const STEPS: { key: string; label: string }[] = [
  { key: "complaint", label: "Complaint" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "estimate", label: "Estimate" },
  { key: "approval", label: "Approval" },
  { key: "repair", label: "Repair" },
  { key: "inspection", label: "Inspection" },
  { key: "invoice", label: "Invoice" },
];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wo = await db.workOrder.findUnique({ where: { id }, select: { number: true } });
  return { title: wo ? woNumber(wo.number) : "Work order" };
}

export default async function WorkOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireStaff();
  const settings = await getSettings();
  const { id } = await params;
  const sp = await searchParams;
  const [wo, technicians, bays, parts, cannedServices] = await Promise.all([
    db.workOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        technician: true,
        bay: true,
        lines: { orderBy: { sortOrder: "asc" }, include: { part: { select: { sku: true } } } },
        photos: { orderBy: { createdAt: "desc" } },
        inspection: { include: { items: true } },
        invoice: true,
        appointment: true,
        timeEntries: { include: { technician: true }, orderBy: { startedAt: "desc" } },
        notifications: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    }),
    db.technician.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.bay.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.part.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, sku: true, name: true, price: true, quantityOnHand: true } }),
    db.cannedService.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!wo) notFound();
  const audit = await db.auditLog.findMany({ where: { entity: "WorkOrder", entityId: id }, orderBy: { createdAt: "desc" }, take: 12, include: { user: { select: { name: true } } } });

  const s = WO_STATUS[wo.status];
  const locked = wo.status === "INVOICED" || wo.status === "CANCELLED";
  const billing = can(user, BILLING_ROLES);
  const stepIndex = (() => {
    if (wo.invoice) return 6;
    if (wo.status === "COMPLETED") return 5;
    if (wo.status === "IN_PROGRESS" || wo.status === "ON_HOLD") return 4;
    if (wo.status === "APPROVED") return 4;
    if (wo.status === "AWAITING_APPROVAL") return 3;
    if (wo.lines.length) return 2;
    if (wo.diagnosis) return 1;
    return 0;
  })();
  const hoursLogged = wo.timeEntries.reduce((sum, e) => sum + differenceInMinutes(e.endedAt ?? new Date(), e.startedAt), 0) / 60;
  const inspCounts = { GOOD: 0, ATTENTION: 0, URGENT: 0, NA: 0 };
  for (const it of wo.inspection?.items ?? []) inspCounts[it.result]++;

  const action = (to: WorkOrderStatus, label: string, Icon: typeof Play, cls = "btn-secondary") => (
    <form key={to} action={setWorkOrderStatus.bind(null, wo.id, to)}>
      <button className={`btn ${cls}`}><Icon size={15} /> {label}</button>
    </form>
  );

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3">{woNumber(wo.number)} <Badge tone={s.tone} className="text-xs">{s.label}</Badge></span>}
        subtitle={<><Link href={`/vehicles/${wo.vehicleId}`} className="text-text hover:text-accent">{vehicleName(wo.vehicle)}</Link>{wo.vehicle.licensePlate ? ` · ${wo.vehicle.licensePlate}` : ""} · <Link href={`/customers/${wo.customerId}`} className="text-accent hover:underline">{wo.customer.firstName} {wo.customer.lastName}</Link>{wo.customer.phone ? ` · ${wo.customer.phone}` : ""}</>}
        crumbs={[{ label: "Work Orders", href: "/work-orders" }, { label: woNumber(wo.number) }]}
        actions={
          <>
            {wo.status === "ESTIMATE" && billing ? (
              <form action={sendForApproval.bind(null, wo.id)}><button className="btn btn-primary"><Send size={15} /> Send for approval</button></form>
            ) : null}
            {wo.status === "ESTIMATE" ? action("APPROVED", "Approve in person", Check) : null}
            {wo.status === "AWAITING_APPROVAL" ? action("APPROVED", "Mark approved", Check, "btn-primary") : null}
            {wo.status === "AWAITING_APPROVAL" && billing ? <form action={sendForApproval.bind(null, wo.id)}><button className="btn btn-secondary"><Send size={15} /> Resend</button></form> : null}
            {wo.status === "APPROVED" ? action("IN_PROGRESS", "Start repair", Play, "btn-primary") : null}
            {wo.status === "IN_PROGRESS" ? action("ON_HOLD", "Waiting parts", Pause) : null}
            {wo.status === "IN_PROGRESS" ? action("COMPLETED", "Complete", Check, "btn-success") : null}
            {wo.status === "ON_HOLD" ? action("IN_PROGRESS", "Resume", Play, "btn-primary") : null}
            {wo.status === "COMPLETED" && billing && !wo.invoice ? <form action={createInvoice.bind(null, wo.id)}><button className="btn btn-primary"><Receipt size={15} /> Create invoice</button></form> : null}
            {wo.status === "COMPLETED" ? action("IN_PROGRESS", "Reopen", Undo2) : null}
            {wo.invoice ? <Link href={`/invoices/${wo.invoice.id}`} className="btn btn-primary"><Receipt size={15} /> {invNumber(wo.invoice.number)}</Link> : null}
            {billing ? <Link href={`/work-orders/${wo.id}/print`} className="btn btn-secondary"><FileText size={15} /> Print</Link> : null}
            {!locked && wo.status !== "CANCELLED" ? action("CANCELLED", "Cancel", XCircle, "btn-ghost text-red-400") : null}
            {wo.status === "CANCELLED" ? action("ESTIMATE", "Restore", Undo2) : null}
          </>
        }
      />
      <Flash searchParams={sp} />

      {/* Workflow stepper */}
      <ol className="card mb-4 px-4 py-3 flex items-center gap-2 overflow-x-auto text-xs">
        {STEPS.map((st, i) => {
          const done = i < stepIndex || (i === 6 && wo.invoice);
          const current = i === stepIndex && !wo.invoice;
          return (
            <li key={st.key} className="flex items-center gap-2 shrink-0">
              <span className={`h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold ${done ? "bg-emerald-500/20 text-emerald-400" : current ? "bg-accent text-white" : "bg-card-hover text-faint"}`}>
                {done ? <Check size={12} /> : i + 1}
              </span>
              <span className={done ? "text-muted" : current ? "text-text font-semibold" : "text-faint"}>{st.label}</span>
              {i < STEPS.length - 1 ? <span className="w-6 h-px bg-border mx-1" /> : null}
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left: details */}
        <div className="space-y-4">
          <Card title="Details">
            <form action={updateWorkOrderDetails.bind(null, wo.id)} className="space-y-3">
              <Field label="Customer complaint"><textarea name="complaint" rows={3} required defaultValue={wo.complaint} className="textarea" disabled={locked} /></Field>
              <Field label="Diagnosis"><textarea name="diagnosis" rows={3} defaultValue={wo.diagnosis ?? ""} className="textarea" placeholder="Findings, codes, root cause" disabled={locked} /></Field>
              <Field label="Technician notes" hint="Visible to the customer on their portal"><textarea name="technicianNotes" rows={2} defaultValue={wo.technicianNotes ?? ""} className="textarea" disabled={locked} /></Field>
              <Field label="Internal notes"><textarea name="internalNotes" rows={2} defaultValue={wo.internalNotes ?? ""} className="textarea" placeholder="Staff only" disabled={locked} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Technician">
                  <select name="technicianId" defaultValue={wo.technicianId ?? ""} className="select" disabled={locked}>
                    <option value="">Unassigned</option>
                    {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </Field>
                <Field label="Bay">
                  <select name="bayId" defaultValue={wo.bayId ?? ""} className="select" disabled={locked}>
                    <option value="">No bay</option>
                    {bays.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
                <Field label="Mileage in"><input name="mileageIn" type="number" min={0} defaultValue={wo.mileageIn ?? ""} className="input" disabled={locked} /></Field>
                <Field label="Mileage out"><input name="mileageOut" type="number" min={0} defaultValue={wo.mileageOut ?? ""} className="input" disabled={locked} /></Field>
                <Field label="Promised by" className="col-span-2"><input name="promisedAt" type="datetime-local" defaultValue={toLocalInput(wo.promisedAt)} className="input" disabled={locked} /></Field>
              </div>
              {!locked ? <button className="btn btn-secondary w-full"><Save size={15} /> Save details</button> : null}
            </form>
          </Card>

          <Card title="Approval">
            <div className="space-y-3 text-sm">
              {wo.approvedAt ? (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-emerald-300">
                  Approved {fmtDateTime(wo.approvedAt)}{wo.approvedBy ? ` by ${wo.approvedBy}` : ""}
                </div>
              ) : wo.declinedAt ? (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-red-300">Declined {fmtDateTime(wo.declinedAt)}{wo.approvedBy ? ` by ${wo.approvedBy}` : ""}</div>
              ) : (
                <p className="text-muted">Not yet approved. Send the estimate and the customer gets a link (email, SMS and portal) to approve line by line.</p>
              )}
              {wo.sentForApprovalAt ? <div className="text-xs text-muted">Sent {fmtDateTime(wo.sentForApprovalAt)}</div> : null}
              {wo.approvalToken && wo.status === "AWAITING_APPROVAL" ? (
                <a href={`/approve/${wo.approvalToken}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-accent text-xs hover:underline">
                  <ExternalLink size={12} /> Open customer approval page
                </a>
              ) : null}
              {wo.notifications.length ? (
                <ul className="border-t border-border pt-3 space-y-1.5">
                  {wo.notifications.map((n) => (
                    <li key={n.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate"><Badge tone={n.status === "SENT" ? "green" : n.status === "FAILED" ? "red" : "amber"}>{n.channel}</Badge> <span className="text-muted ml-1">{n.subject}</span></span>
                      <span className="text-faint shrink-0">{fmtRelative(n.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Card>

          <Card title="Time & activity">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Stat label="Hours logged" value={`${hoursLogged.toFixed(1)} h`} />
              <Stat label="Labor billed" value={`${wo.lines.filter((l) => l.kind === "LABOR" && l.approved).reduce((a, l) => a + Number(l.hours ?? l.quantity), 0).toFixed(1)} h`} />
              <Stat label="Created" value={fmtDateTime(wo.createdAt)} />
              <Stat label="Started" value={fmtDateTime(wo.startedAt)} />
              <Stat label="Completed" value={fmtDateTime(wo.completedAt)} />
              <Stat label="Mileage" value={wo.mileageIn ? `${num(wo.mileageIn)}${wo.mileageOut ? ` → ${num(wo.mileageOut)}` : ""}` : "—"} />
            </div>
            <ul className="space-y-1.5 text-xs border-t border-border pt-3">
              {audit.map((a) => (
                <li key={a.id} className="flex justify-between gap-2"><span className="text-muted">{a.action.replace("status:", "→ ").replaceAll("_", " ")}{a.user ? ` · ${a.user.name}` : ""}</span><span className="text-faint shrink-0">{fmtRelative(a.createdAt)}</span></li>
              ))}
              {!audit.length ? <li className="text-faint">No activity yet.</li> : null}
            </ul>
          </Card>

          {can(user, MANAGER_ROLES) && !wo.invoice ? (
            <form action={deleteWorkOrder.bind(null, wo.id)} className="text-right">
              <ConfirmButton message="Delete this work order?"><Trash2 size={14} /> Delete</ConfirmButton>
            </form>
          ) : null}
        </div>

        {/* Right: lines, inspection, photos */}
        <div className="xl:col-span-2 space-y-4">
          <Card title={wo.status === "ESTIMATE" || wo.status === "AWAITING_APPROVAL" ? "Estimate" : "Parts & labor"} action={wo.technician ? <span className="flex items-center gap-2 text-xs text-muted"><Avatar name={wo.technician.name} color={wo.technician.color} size={20} /> {wo.technician.name}{wo.bay ? ` · ${wo.bay.name}` : ""}</span> : null}>
            <LinesEditor workOrderId={wo.id} lines={wo.lines} parts={parts} cannedServices={cannedServices} taxRate={settings.taxRate} laborRate={settings.laborRate} taxExempt={wo.customer.taxExempt} editable={!locked} />
          </Card>

          <Card
            title="Inspection"
            action={
              wo.inspection ? (
                <Link href={`/inspections/${wo.inspection.id}`} className="btn btn-secondary btn-sm"><ClipboardCheck size={14} /> Open report</Link>
              ) : !locked ? (
                <form action={startInspection.bind(null, wo.id)}><button className="btn btn-secondary btn-sm"><ClipboardCheck size={14} /> Start inspection</button></form>
              ) : null
            }
          >
            {wo.inspection ? (
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {(["GOOD", "ATTENTION", "URGENT", "NA"] as const).map((k) => (
                  <span key={k} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${INSPECTION_RESULT[k].dot}`} />{inspCounts[k]} {INSPECTION_RESULT[k].label}</span>
                ))}
                {wo.inspection.summary ? <span className="text-muted basis-full">{wo.inspection.summary}</span> : null}
              </div>
            ) : (
              <p className="text-sm text-muted">Run the shop&apos;s multi-point inspection checklist from a tablet at the vehicle — results and photos show on the customer portal.</p>
            )}
          </Card>

          <Card title="Photos">
            <PhotoGrid photos={wo.photos} vehicleId={wo.vehicleId} workOrderId={wo.id} returnTo={`/work-orders/${wo.id}`} compact />
          </Card>
        </div>
      </div>
    </div>
  );
}
