import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CreditCard, Printer, Save, Send } from "lucide-react";
import { requireStaff, can, BILLING_ROLES, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Field, Flash, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { InvoiceSheet } from "@/components/app/invoice-sheet";
import { recordPayment, resendInvoice, updateInvoiceNotes, voidInvoice } from "@/actions/invoices";
import { INVOICE_STATUS, PAYMENT_METHODS } from "@/lib/constants";
import { fmtDateTime, invNumber, money, toDateInput, woNumber } from "@/lib/format";
import { CopyField } from "@/app/(app)/settings/copy-field";
import { publicBase } from "@/lib/templates";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, select: { number: true } });
  return { title: inv ? invNumber(inv.number) : "Invoice" };
}

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireStaff(BILLING_ROLES);
  const settings = await getSettings();
  const { id } = await params;
  const sp = await searchParams;
  const inv = await db.invoice.findUnique({ where: { id }, include: { customer: true, payments: { orderBy: { paidAt: "desc" } }, workOrder: { include: { vehicle: true, lines: { orderBy: { sortOrder: "asc" } } } } } });
  if (!inv) notFound();
  const balance = Number(inv.total) - Number(inv.amountPaid);
  const st = INVOICE_STATUS[inv.status];
  const payLink = inv.payToken ? `${await publicBase()}/pay/${inv.payToken}` : null;

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3">{invNumber(inv.number)} <Badge tone={st.tone}>{st.label}</Badge></span>}
        subtitle={<>{inv.customer.firstName} {inv.customer.lastName} · <Link href={`/work-orders/${inv.workOrderId}`} className="text-accent hover:underline">{woNumber(inv.workOrder.number)}</Link></>}
        crumbs={[{ label: "Invoices", href: "/invoices" }, { label: invNumber(inv.number) }]}
        actions={
          <>
            <Link href={`/invoices/${inv.id}/print`} className="btn btn-secondary"><Printer size={15} /> Print / PDF</Link>
            {inv.status !== "VOID" && inv.status !== "PAID" ? <form action={resendInvoice.bind(null, inv.id)}><button className="btn btn-secondary"><Send size={15} /> Send to customer</button></form> : null}
            {inv.status !== "VOID" && !inv.payments.length && can(user, MANAGER_ROLES) ? <form action={voidInvoice.bind(null, inv.id)}><ConfirmButton message="Void this invoice? The work order returns to Completed." className="btn btn-ghost text-red-400"><Ban size={15} /> Void</ConfirmButton></form> : null}
          </>
        }
      />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <InvoiceSheet kind="INVOICE" settings={settings} number={inv.number} workOrderNumber={inv.workOrder.number} date={inv.issuedAt} dueAt={inv.dueAt} customer={inv.customer} vehicle={inv.workOrder.vehicle} lines={inv.workOrder.lines} complaint={inv.workOrder.complaint} diagnosis={inv.workOrder.diagnosis} mileageIn={inv.workOrder.mileageIn} amountPaid={Number(inv.amountPaid)} notes={inv.notes} />
        </div>
        <div className="space-y-4">
          {payLink && inv.status !== "VOID" ? (
            <Card title="Customer pay link">
              <p className="text-xs text-muted">Text or email this link — the customer can view the invoice{settings.stripeConfigured ? " and pay by card" : ""} without signing in.</p>
              <CopyField value={payLink} />
            </Card>
          ) : null}
          <Card title="Record payment">
            {inv.status === "VOID" ? (
              <p className="text-sm text-muted">This invoice is void.</p>
            ) : balance <= 0.005 ? (
              <p className="text-sm text-emerald-400">Paid in full. Thank you!</p>
            ) : (
              <form action={recordPayment.bind(null, inv.id)} className="space-y-3">
                <Field label="Amount"><input name="amount" type="number" step="0.01" min="0.01" max={balance.toFixed(2)} defaultValue={balance.toFixed(2)} required className="input" /></Field>
                <Field label="Method">
                  <select name="method" className="select" defaultValue="CARD">
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m[0] + m.slice(1).toLowerCase()}</option>)}
                  </select>
                </Field>
                <Field label="Reference"><input name="reference" className="input" placeholder="Auth code, check #, …" /></Field>
                <button className="btn btn-primary w-full"><CreditCard size={15} /> Record {money(balance)}</button>
              </form>
            )}
            {inv.payments.length ? (
              <ul className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
                {inv.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2"><span>{money(p.amount)} <span className="text-muted text-xs">{p.method.toLowerCase()}{p.reference ? ` · ${p.reference}` : ""}</span></span><span className="text-xs text-faint">{fmtDateTime(p.paidAt)}</span></li>
                ))}
              </ul>
            ) : null}
          </Card>
          <Card title="Terms & notes">
            <form action={updateInvoiceNotes.bind(null, inv.id)} className="space-y-3">
              <Field label="Due date"><input name="dueAt" type="date" defaultValue={toDateInput(inv.dueAt)} className="input" /></Field>
              <Field label="Notes on invoice"><textarea name="notes" rows={3} defaultValue={inv.notes ?? ""} className="textarea" /></Field>
              <button className="btn btn-secondary w-full"><Save size={15} /> Save</button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
