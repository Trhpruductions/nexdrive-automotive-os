import Image from "next/image";
import { notFound } from "next/navigation";
import { CheckCircle2, CreditCard } from "lucide-react";
import { rawDb, withShop } from "@/lib/db";
import { invoiceView } from "@/lib/invoice-view";
import { getSettings, accentVars, shopAddress } from "@/lib/settings";
import { InvoiceSheet } from "@/components/app/invoice-sheet";
import { PrintButton } from "@/components/app/print-button";
import { payByToken } from "@/actions/pay";
import { money } from "@/lib/format";

export const metadata = { title: "Your invoice" };

/** Public view-and-pay page from the invoice email/SMS link (no login). */
export default async function PayPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string; cancelled?: string; error?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const found = await rawDb.invoice.findUnique({ where: { payToken: token }, select: { shopId: true } });
  if (!found) notFound();
  return withShop(found.shopId, async () => {
    const s = await getSettings();
    const row = await rawDb.invoice.findUnique({ where: { payToken: token }, select: { id: true } });
    const view = row ? await invoiceView(row.id) : null;
    if (!view) notFound();
    const { inv } = view;
    const balance = Math.round((Number(inv.total) - Number(inv.amountPaid)) * 100) / 100;
    const paid = balance <= 0.005 || inv.status === "PAID";
    return (
      <main className="app-canvas min-h-screen py-8 px-4" style={accentVars(s.accentColor)}>
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              {s.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <Image src="/brand/mark.png" alt="" width={48} height={48} />
              )}
              <div><div className="font-semibold">{s.name}</div><div className="text-xs text-muted">{shopAddress(s).join(", ")}{s.phone ? ` · ${s.phone}` : ""}</div></div>
            </div>
            <PrintButton />
          </div>

          {paid || sp.paid ? (
            <div className="no-print card p-6 text-center">
              <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
              <h1 className="text-xl font-semibold mt-3">{paid ? "Paid in full — thank you" : "Payment received — thank you"}</h1>
              <p className="text-sm text-muted mt-1">{paid ? "This invoice is settled. Keep this page for your records." : "It will show as paid here as soon as Stripe confirms it."}</p>
            </div>
          ) : (
            <div className="no-print card p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="text-[11px] tracking-[0.2em] text-accent font-bold">BALANCE DUE</div>
                <div className="text-3xl font-semibold">{money(balance)}</div>
                <div className="text-sm text-muted">Invoice INV-{String(inv.number).padStart(5, "0")}{inv.dueAt ? ` · due ${inv.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</div>
              </div>
              {s.stripeConfigured && inv.status !== "VOID" ? (
                <form action={payByToken.bind(null, token)} className="flex flex-col items-stretch gap-1">
                  <button className="btn btn-primary py-3 px-6 text-base"><CreditCard size={18} /> Pay {money(balance)} by card</button>
                  <span className="text-[11px] text-faint text-center">Secure checkout by Stripe</span>
                </form>
              ) : (
                <div className="text-sm text-muted">Pay at the counter{s.phone ? ` or call ${s.phone}` : ""}.</div>
              )}
            </div>
          )}
          {sp.cancelled ? <p className="no-print text-sm text-muted text-center">Payment cancelled — nothing was charged.</p> : null}
          {sp.error ? <p className="no-print text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">{sp.error}</p> : null}

          <InvoiceSheet
            kind="INVOICE"
            settings={s}
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
          <p className="no-print text-center text-[11px] text-faint">Powered by NexDrive Automotive OS</p>
        </div>
      </main>
    );
  });
}
