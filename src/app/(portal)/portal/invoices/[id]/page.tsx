import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CreditCard } from "lucide-react";
import { startCardPayment } from "@/actions/portal";
import { requireCustomer } from "@/lib/auth";
import { invoiceView } from "@/lib/invoice-view";
import { getSettings } from "@/lib/settings";
import { InvoiceSheet } from "@/components/app/invoice-sheet";
import { PrintButton } from "@/components/app/print-button";

export const metadata = { title: "Invoice" };

export default async function PortalInvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string; cancelled?: string; error?: string }> }) {
  const user = await requireCustomer();
  const settings = await getSettings();
  const { id } = await params;
  const sp = await searchParams;
  const view = await invoiceView(id);
  if (!view || view.inv.customerId !== user.customerId) notFound();
  const { inv } = view;
  const balance = Number(inv.total) - Number(inv.amountPaid);

  return (
    <div className="space-y-4">
      <div className="no-print flex justify-between items-center">
        <Link href="/portal" className="text-sm text-muted hover:text-text inline-flex items-center gap-1"><ArrowLeft size={14} /> Back</Link>
        <PrintButton />
      </div>
      <InvoiceSheet
        kind="INVOICE"
        settings={settings}
        number={inv.number}
        workOrderNumber={view.workOrderNumber}
        reference={view.reference}
        date={inv.issuedAt}
        dueAt={inv.dueAt}
        customer={inv.customer}
        vehicle={view.vehicle}
        lines={view.lines}
        complaint={view.complaint}
        diagnosis={view.diagnosis}
        mileageIn={view.mileageIn}
        amountPaid={Number(inv.amountPaid)}
        notes={inv.notes}
      />
      {sp.paid ? <p className="no-print text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-center">Thank you — your card payment went through. {balance > 0.005 ? "It will show here as soon as Stripe confirms it." : ""}</p> : null}
      {sp.cancelled ? <p className="no-print text-sm text-muted text-center">Payment cancelled — nothing was charged.</p> : null}
      {sp.error ? <p className="no-print text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">{sp.error}</p> : null}
      {balance > 0.005 && !sp.paid ? (
        settings.stripeConfigured && inv.status !== "VOID" ? (
          <form action={startCardPayment.bind(null, inv.id)} className="no-print flex flex-col items-center gap-2">
            <button className="btn btn-primary px-6"><CreditCard size={16} /> Pay ${balance.toFixed(2)} by card</button>
            <p className="text-xs text-faint">Secure checkout by Stripe. Or pay at the counter{settings.phone ? ` / call ${settings.phone}` : ""}.</p>
          </form>
        ) : (
          <p className="text-sm text-muted text-center">Balance due. Pay at the counter or call {settings.phone}.</p>
        )
      ) : null}
    </div>
  );
}
