import Image from "next/image";
import type { ShopSettings } from "@/lib/settings";
import { shopAddress } from "@/lib/settings";
import { computeTotals, lineTotal } from "@/lib/money";
import { fmtDate, invNumber, money, num, vehicleName, woNumber } from "@/lib/format";

type Line = { id: string; kind: "LABOR" | "PART" | "FEE" | "DISCOUNT"; description: string; quantity: { toString(): string }; unitPrice: { toString(): string }; hours: { toString(): string } | null; taxable: boolean; approved: boolean };

/**
 * Printable estimate / invoice document — shared by the invoice page, the print view,
 * the public approval page and the customer portal.
 */
export function InvoiceSheet({
  kind,
  settings,
  number,
  workOrderNumber,
  date,
  dueAt,
  customer,
  vehicle,
  lines,
  complaint,
  diagnosis,
  mileageIn,
  reference,
  amountPaid = 0,
  notes,
  showDeclined = false,
}: {
  kind: "ESTIMATE" | "INVOICE";
  settings: ShopSettings;
  number: number;
  workOrderNumber?: number | null;
  /** e.g. "Shipment SH-00001 · PO 4471" for goods invoices */
  reference?: string | null;
  date: Date;
  dueAt?: Date | null;
  customer: { firstName: string; lastName: string; company?: string | null; email?: string | null; phone?: string | null; address?: string | null; city?: string | null; state?: string | null; zip?: string | null; taxExempt: boolean };
  vehicle?: { year: number; make: string; model: string; trim?: string | null; vin?: string | null; licensePlate?: string | null; color?: string | null } | null;
  lines: Line[];
  complaint?: string | null;
  diagnosis?: string | null;
  mileageIn?: number | null;
  amountPaid?: number;
  notes?: string | null;
  showDeclined?: boolean;
}) {
  const t = computeTotals(lines, settings.taxRate, { taxExempt: customer.taxExempt });
  const visible = showDeclined ? lines : lines.filter((l) => l.approved);
  const balance = Math.max(0, t.total - amountPaid);

  return (
    <div className="print-sheet card p-6 sm:p-8 text-sm">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
          ) : (
            <Image src="/brand/mark.png" alt="" width={56} height={56} />
          )}
          <div>
            <div className="text-lg font-semibold leading-tight">{settings.name}</div>
            <div className="text-muted text-xs">{settings.tagline}</div>
            <div className="text-muted text-xs mt-1">{shopAddress(settings).join(" · ")}</div>
            <div className="text-muted text-xs">{[settings.phone, settings.email, settings.website].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div className="sm:text-right">
          <div className="text-[11px] tracking-[0.2em] text-accent font-bold">{kind}</div>
          <div className="text-2xl font-semibold">{kind === "INVOICE" ? invNumber(number) : woNumber(number)}</div>
          <div className="text-xs text-muted">{kind === "INVOICE" && workOrderNumber ? `Work order ${woNumber(workOrderNumber)} · ` : ""}{reference ? `${reference} · ` : ""}{fmtDate(date)}</div>
          {dueAt ? <div className="text-xs text-muted">Due {fmtDate(dueAt)}</div> : null}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mt-8">
        <div>
          <div className="card-title mb-1.5">Bill to</div>
          <div className="font-medium">{customer.firstName} {customer.lastName}</div>
          {customer.company ? <div>{customer.company}</div> : null}
          {customer.address ? <div className="text-muted">{customer.address}</div> : null}
          {customer.city || customer.zip ? <div className="text-muted">{[customer.city, customer.state].filter(Boolean).join(", ")} {customer.zip}</div> : null}
          <div className="text-muted">{[customer.phone, customer.email].filter(Boolean).join(" · ")}</div>
        </div>
        {vehicle ? (
          <div>
            <div className="card-title mb-1.5">{settings.terms.asset}</div>
            <div className="font-medium">{vehicleName(vehicle)}</div>
            <div className="text-muted">{[vehicle.color, vehicle.licensePlate].filter(Boolean).join(" · ")}</div>
            {vehicle.vin ? <div className="text-muted font-mono text-xs">{settings.terms.serial} {vehicle.vin}</div> : null}
            {mileageIn && settings.terms.odometer ? <div className="text-muted">{settings.terms.odometer} {num(mileageIn)}</div> : null}
          </div>
        ) : (
          <div>
            <div className="card-title mb-1.5">Shipment</div>
            <div className="text-muted">{reference ?? "Goods invoice"}</div>
          </div>
        )}
      </div>

      {complaint || diagnosis ? (
        <div className="grid sm:grid-cols-2 gap-6 mt-6">
          {complaint ? <div><div className="card-title mb-1">Concern</div><p className="text-muted">{complaint}</p></div> : null}
          {diagnosis ? <div><div className="card-title mb-1">Findings</div><p className="text-muted">{diagnosis}</p></div> : null}
        </div>
      ) : null}

      <table className="table mt-8">
        <thead><tr><th>Description</th><th className="text-right">Qty / Hrs</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
        <tbody>
          {visible.map((l) => (
            <tr key={l.id} className={!l.approved ? "opacity-50" : ""}>
              <td><span className="text-[10px] uppercase tracking-wider text-faint mr-2">{l.kind.toLowerCase()}</span>{l.description}{!l.approved ? <span className="text-red-400 text-xs ml-2">declined</span> : null}</td>
              <td className="text-right tabular-nums">{Number(l.kind === "LABOR" ? l.hours ?? l.quantity : l.quantity)}</td>
              <td className="text-right tabular-nums">{money(l.unitPrice)}</td>
              <td className="text-right tabular-nums">{money(lineTotal(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-col sm:flex-row justify-between gap-6 mt-6">
        <div className="text-xs text-muted max-w-sm space-y-2">
          {notes ? <p>{notes}</p> : null}
          {settings.invoiceFooter ? <p>{settings.invoiceFooter}</p> : null}
        </div>
        <dl className="w-full sm:w-64 space-y-1">
          <div className="flex justify-between text-muted"><dt>Labor</dt><dd className="tabular-nums">{money(t.labor)}</dd></div>
          <div className="flex justify-between text-muted"><dt>Parts</dt><dd className="tabular-nums">{money(t.parts)}</dd></div>
          {t.fees ? <div className="flex justify-between text-muted"><dt>Fees</dt><dd className="tabular-nums">{money(t.fees)}</dd></div> : null}
          {t.discount ? <div className="flex justify-between text-emerald-400"><dt>Discount</dt><dd className="tabular-nums">{money(t.discount)}</dd></div> : null}
          <div className="flex justify-between border-t border-border pt-1"><dt>Subtotal</dt><dd className="tabular-nums">{money(t.subtotal)}</dd></div>
          <div className="flex justify-between text-muted"><dt>Tax {customer.taxExempt ? "(exempt)" : `${(settings.taxRate * 100).toFixed(2)}%`}</dt><dd className="tabular-nums">{money(t.tax)}</dd></div>
          <div className="flex justify-between text-base font-semibold border-t border-border pt-1.5"><dt>Total</dt><dd className="tabular-nums">{money(t.total)}</dd></div>
          {kind === "INVOICE" ? (
            <>
              <div className="flex justify-between text-muted"><dt>Paid</dt><dd className="tabular-nums">{money(amountPaid)}</dd></div>
              <div className={`flex justify-between font-semibold ${balance > 0 ? "text-amber-400" : "text-emerald-400"}`}><dt>Balance due</dt><dd className="tabular-nums">{money(balance)}</dd></div>
            </>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
