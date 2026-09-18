import Image from "next/image";
import { notFound } from "next/navigation";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings, shopAddress } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/app/print-button";
import { fmtDate, num } from "@/lib/format";
import { jobNumber, shipNumber } from "@/lib/production";
import { QC_KIND, shipmentTrace } from "@/lib/quality";

export const metadata = { title: "Certificate of Conformance" };

/**
 * The C of C that rides with a stamping shipment: part, revision, quantity,
 * the coil lots / heat numbers the parts came from, and the last inspection.
 */
export default async function CocPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff(BILLING_ROLES);
  const { id } = await params;
  const [s, settings] = await Promise.all([
    db.shipment.findUnique({ where: { id }, include: { customer: true, lines: { include: { part: { select: { sku: true, name: true, customerPartNumber: true, drawingRev: true, description: true } }, job: { select: { number: true, customerPo: true } } } } } }),
    getSettings(),
  ]);
  if (!s) notFound();
  const trace = await shipmentTrace(s.id);
  const pos = [...new Set(s.lines.map((l) => l.job?.customerPo).filter(Boolean))];
  const customer = s.customer.company ?? `${s.customer.firstName} ${s.customer.lastName}`;
  return (
    <div>
      <PageHeader title="Certificate of Conformance" subtitle={`${shipNumber(s.number)} · ${customer}`} crumbs={[{ label: "Shipments", href: "/shipments" }, { label: shipNumber(s.number), href: `/shipments/${s.id}` }, { label: "C of C" }]} actions={<PrintButton />} />
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
            <div className="text-[11px] tracking-[0.2em] text-accent font-bold">CERTIFICATE OF CONFORMANCE</div>
            <div className="text-xl font-semibold">{shipNumber(s.number)}</div>
            <div className="text-xs text-muted">{fmtDate(s.shipDate ?? s.createdAt)}{pos.length ? ` · PO ${pos.join(", ")}` : ""}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 mt-8">
          <div><div className="card-title mb-1">Customer</div><div className="whitespace-pre-line">{s.shipTo ?? customer}</div></div>
          <div><div className="card-title mb-1">Carrier / tracking</div><div>{[s.carrier, s.tracking].filter(Boolean).join(" · ") || "—"}</div></div>
        </div>
        <table className="table mt-8">
          <thead><tr><th>Part</th><th>Rev</th><th className="text-right">Quantity</th><th>Job</th><th>Material lot / heat</th><th>Inspection</th></tr></thead>
          <tbody>
            {s.lines.map((l) => {
              const t = trace.get(l.id);
              return (
                <tr key={l.id}>
                  <td><div className="font-medium">{l.part.customerPartNumber ?? l.part.sku}</div><div className="text-xs text-muted">{l.part.customerPartNumber ? `${l.part.sku} · ` : ""}{l.part.name}</div></td>
                  <td className="font-mono text-xs">{l.part.drawingRev ?? "—"}</td>
                  <td className="text-right tabular-nums">{num(l.quantity)}</td>
                  <td className="text-xs text-muted">{l.job ? jobNumber(l.job.number) : "stock"}</td>
                  <td className="text-xs font-mono">{t?.lots.length ? t.lots.map((x) => <div key={x.id}>{x.lotNumber}{x.heatNumber ? ` / ${x.heatNumber}` : ""}{x.supplier ? <span className="text-muted font-sans"> · {x.supplier}</span> : null}</div>) : "—"}</td>
                  <td className="text-xs">{t?.lastCheck ? <>{QC_KIND[t.lastCheck.kind]} <span className={t.lastCheck.result === "PASS" ? "text-emerald-500" : "text-red-500"}>{t.lastCheck.result.toLowerCase()}</span><div className="text-muted">{fmtDate(t.lastCheck.checkedAt)}{t.lastCheck.inspector ? ` · ${t.lastCheck.inspector}` : ""}</div></> : <span className="text-muted">no check on file</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-8 leading-relaxed">
          {settings.name} certifies that the parts listed above were manufactured and inspected in accordance with the applicable drawings, specifications and purchase order requirements, and conform to those requirements. Material certifications for the lots and heat numbers shown are retained on file and available on request.
        </p>
        <div className="grid sm:grid-cols-2 gap-8 mt-10 text-xs">
          <div><div className="border-b border-border pb-8" /><div className="mt-1 text-muted">Authorised signature — {user.name}</div></div>
          <div><div className="border-b border-border pb-8" /><div className="mt-1 text-muted">Date</div></div>
        </div>
      </div>
    </div>
  );
}
