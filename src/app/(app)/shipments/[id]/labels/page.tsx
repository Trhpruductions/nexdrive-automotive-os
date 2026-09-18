import { notFound } from "next/navigation";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { jobNumber, shipNumber } from "@/lib/production";
import { shipmentTrace } from "@/lib/quality";
import { CartonLabels, type CartonLabel } from "./carton-labels";

export const metadata = { title: "Carton labels" };

/** One label per carton, cartons from the product's pack quantity (the last one takes the remainder). */
export default async function LabelsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(BILLING_ROLES);
  const { id } = await params;
  const [s, settings] = await Promise.all([
    db.shipment.findUnique({ where: { id }, include: { customer: { select: { company: true, firstName: true, lastName: true } }, lines: { include: { part: { select: { sku: true, name: true, customerPartNumber: true, drawingRev: true, packQty: true } }, job: { select: { number: true, customerPo: true } } } } } }),
    getSettings(),
  ]);
  if (!s) notFound();
  const trace = await shipmentTrace(s.id);
  const customer = s.customer.company ?? `${s.customer.firstName} ${s.customer.lastName}`;
  const date = fmtDate(s.shipDate ?? s.createdAt);
  const labels: CartonLabel[] = s.lines.flatMap((l) => {
    const pack = l.part.packQty && l.part.packQty > 0 ? l.part.packQty : l.quantity;
    const cartons = Math.max(1, Math.ceil(l.quantity / pack));
    const lots = trace.get(l.id)?.lots.map((x) => `${x.lotNumber}${x.heatNumber ? `/${x.heatNumber}` : ""}`).join(", ") ?? "";
    return Array.from({ length: cartons }, (_, i) => ({
      key: `${l.id}-${i}`, shopName: settings.name, customer, customerPart: l.part.customerPartNumber, sku: l.part.sku, name: l.part.name, rev: l.part.drawingRev,
      qty: i === cartons - 1 ? l.quantity - pack * (cartons - 1) : pack, carton: i + 1, cartons, job: l.job ? jobNumber(l.job.number) : null, po: l.job?.customerPo ?? null, lots, shipment: shipNumber(s.number), date,
    }));
  });
  return (
    <div>
      <PageHeader title="Carton labels" subtitle={`${shipNumber(s.number)} · ${customer} · ${labels.length} carton${labels.length === 1 ? "" : "s"}`} crumbs={[{ label: "Shipments", href: "/shipments" }, { label: shipNumber(s.number), href: `/shipments/${s.id}` }, { label: "Labels" }]} />
      <CartonLabels labels={labels} />
    </div>
  );
}
