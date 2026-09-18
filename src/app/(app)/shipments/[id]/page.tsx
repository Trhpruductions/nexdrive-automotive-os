import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt, Truck } from "lucide-react";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings, shopAddress } from "@/lib/settings";
import { Badge, Card, Flash, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { PrintButton } from "@/components/app/print-button";
import { invoiceShipment, markShipped } from "@/actions/production";
import { fmtDate, money, num } from "@/lib/format";
import { jobNumber, shipNumber } from "@/lib/production";

export default async function ShipmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireStaff(BILLING_ROLES);
  const { id } = await params;
  const sp = await searchParams;
  const [s, settings] = await Promise.all([
    db.shipment.findUnique({ where: { id }, include: { customer: true, invoice: { select: { id: true, number: true, status: true } }, lines: { include: { part: { select: { sku: true, name: true, customerPartNumber: true, unit: true, packQty: true } }, job: { select: { id: true, number: true, customerPo: true } } } } } }),
    getSettings(),
  ]);
  if (!s) notFound();
  const pieces = s.lines.reduce((a, l) => a + l.quantity, 0);
  const value = s.lines.reduce((a, l) => a + l.quantity * Number(l.unitPrice), 0);
  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3">{shipNumber(s.number)} <Badge tone={s.status === "SHIPPED" ? "green" : "slate"}>{s.status.toLowerCase()}</Badge></span>}
        subtitle={<><Link href={`/customers/${s.customerId}`} className="text-accent hover:underline">{s.customer.company ?? `${s.customer.firstName} ${s.customer.lastName}`}</Link> · {num(pieces)} pieces · {money(value)}{s.shipDate ? ` · shipped ${fmtDate(s.shipDate)}` : ""}</>}
        crumbs={[{ label: "Shipments", href: "/shipments" }, { label: shipNumber(s.number) }]}
        actions={
          <>
            <PrintButton />
            {s.status === "DRAFT" ? <form action={markShipped.bind(null, s.id)}><ConfirmButton message={`Mark ${shipNumber(s.number)} shipped? ${num(pieces)} pieces leave finished-goods stock.`} className="btn btn-primary"><Truck size={15} /> Mark shipped</ConfirmButton></form> : null}
            {s.status === "SHIPPED" && !s.invoice ? <form action={invoiceShipment.bind(null, s.id)}><button className="btn btn-primary"><Receipt size={15} /> Create invoice</button></form> : null}
            {s.invoice ? <Link href={`/invoices/${s.invoice.id}`} className="btn btn-secondary"><Receipt size={15} /> INV-{String(s.invoice.number).padStart(5, "0")}</Link> : null}
          </>
        }
      />
      <Flash searchParams={sp} />
      {/* packing slip */}
      <div className="print-sheet card p-6 sm:p-8 text-sm max-w-3xl">
        <div className="flex flex-col sm:flex-row justify-between gap-6">
          <div className="flex items-center gap-4">
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
            ) : (
              <Image src="/brand/mark.png" alt="" width={56} height={56} />
            )}
            <div>
              <div className="text-lg font-semibold leading-tight">{settings.name}</div>
              <div className="text-muted text-xs">{shopAddress(settings).join(" · ")}</div>
              <div className="text-muted text-xs">{[settings.phone, settings.email].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-[11px] tracking-[0.2em] text-accent font-bold">PACKING SLIP</div>
            <div className="text-xl font-semibold">{shipNumber(s.number)}</div>
            <div className="text-xs text-muted">{fmtDate(s.shipDate ?? s.createdAt)}{s.carrier ? ` · ${s.carrier}` : ""}{s.tracking ? ` · ${s.tracking}` : ""}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 mt-8">
          <div><div className="card-title mb-1">Ship to</div><div className="whitespace-pre-line">{s.shipTo ?? (s.customer.company ?? `${s.customer.firstName} ${s.customer.lastName}`)}</div></div>
          <div><div className="card-title mb-1">Customer POs</div><div>{[...new Set(s.lines.map((l) => l.job?.customerPo).filter(Boolean))].join(", ") || "—"}</div></div>
        </div>
        <table className="table mt-8">
          <thead><tr><th>Part</th><th>Job</th><th className="text-right">Quantity</th><th className="text-right">Cartons</th><th className="text-right">Unit price</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {s.lines.map((l) => (
              <tr key={l.id}>
                <td><div className="font-medium">{l.part.sku}</div><div className="text-xs text-muted">{l.part.name}{l.part.customerPartNumber ? ` · cust. ${l.part.customerPartNumber}` : ""}</div></td>
                <td className="text-xs text-muted">{l.job ? jobNumber(l.job.number) : "stock"}</td>
                <td className="text-right tabular-nums">{num(l.quantity)} {l.part.unit}</td>
                <td className="text-right tabular-nums text-muted">{l.part.packQty ? Math.ceil(l.quantity / l.part.packQty) : "—"}</td>
                <td className="text-right tabular-nums">{money(l.unitPrice)}</td>
                <td className="text-right tabular-nums">{money(l.quantity * Number(l.unitPrice))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end mt-4 text-sm"><div className="w-56 flex justify-between font-semibold"><span>Total pieces</span><span className="tabular-nums">{num(pieces)}</span></div></div>
        {s.notes ? <p className="mt-6 text-muted">{s.notes}</p> : null}
        <p className="mt-8 text-[11px] text-faint">Received by ______________________ Date __________</p>
      </div>
      {s.status === "SHIPPED" && !s.invoice ? <Card className="mt-4 no-print"><p className="text-sm text-muted">Shipped. <span className="text-text">Create invoice</span> bills these lines at the product prices ({money(value)} + tax) with a pay link for the customer.</p></Card> : null}
    </div>
  );
}
