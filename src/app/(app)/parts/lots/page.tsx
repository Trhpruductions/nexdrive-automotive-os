import Link from "next/link";
import { Layers, PackagePlus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, EmptyState, Field, Flash, KpiCard, PageHeader, Progress } from "@/components/ui";
import { receiveLot } from "@/actions/quality";
import { fmtDate, num, toDateInput } from "@/lib/format";

export const metadata = { title: "Material lots" };

/**
 * Coils and bundles by lot / heat number. Receiving one books it into the
 * material's stock; jobs draw it down as they run, so every shipped part can
 * be traced back to the steel it came from.
 */
export default async function LotsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; show?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const showAll = sp.show === "all";
  const [lots, materials] = await Promise.all([
    db.materialLot.findMany({ where: showAll ? {} : { remaining: { gt: 0 } }, include: { part: { select: { id: true, sku: true, name: true, unit: true } }, _count: { select: { runs: true } } }, orderBy: [{ part: { sku: "asc" } }, { receivedAt: "asc" }], take: 300 }),
    db.part.findMany({ where: { kind: "MATERIAL", active: true }, orderBy: { sku: "asc" }, select: { id: true, sku: true, name: true, unit: true, quantityOnHand: true } }),
  ]);
  const open = lots.filter((l) => Number(l.remaining) > 0);
  const noCert = open.filter((l) => !l.certOnFile).length;
  const totalLeft = open.reduce((s, l) => s + Number(l.remaining), 0);
  return (
    <div>
      <PageHeader title="Material lots" subtitle="Coils and bundles by lot and heat number — traceable from receipt to the parts that shipped." crumbs={[{ label: "Parts & Inventory", href: "/parts" }, { label: "Material lots" }]} actions={<Link href={showAll ? "/parts/lots" : "/parts/lots?show=all"} className="btn btn-secondary">{showAll ? "Only with material left" : "Show used-up lots"}</Link>} />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Open lots" value={open.length} icon={Layers} tone="blue" />
        <KpiCard label="Material on lots" value={num(Math.round(totalLeft))} icon={Layers} tone="slate" />
        <KpiCard label="Missing mill cert" value={noCert} icon={Layers} tone={noCert ? "amber" : "green"} />
        <KpiCard label="Materials" value={materials.length} icon={Layers} tone="slate" href="/parts?kind=MATERIAL" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" padded={false}>
          {lots.length ? (
            <table className="table">
              <thead><tr><th>Lot</th><th>Material</th><th>Heat</th><th>Supplier</th><th className="w-40">Remaining</th><th>Received</th><th>Cert</th></tr></thead>
              <tbody>
                {lots.map((l) => {
                  const rem = Number(l.remaining);
                  const qty = Number(l.quantity);
                  return (
                    <tr key={l.id} className="row-link">
                      <td><Link href={`/parts/lots/${l.id}`} className="font-mono font-semibold hover:text-accent">{l.lotNumber}</Link>{l._count.runs ? <div className="text-[11px] text-muted">{l._count.runs} run{l._count.runs === 1 ? "" : "s"}</div> : null}</td>
                      <td className="text-sm"><div>{l.part.sku}</div><div className="text-xs text-muted">{l.part.name}</div></td>
                      <td className="font-mono text-xs">{l.heatNumber ?? "—"}</td>
                      <td className="text-xs text-muted">{l.supplier ?? "—"}</td>
                      <td><div className="flex items-center gap-2"><Progress value={qty ? rem / qty : 0} tone={rem <= 0 ? "slate" : rem / qty < 0.2 ? "amber" : "green"} className="flex-1" /><span className="text-xs tabular-nums whitespace-nowrap">{num(Math.round(rem))} / {num(Math.round(qty))} {l.unit}</span></div></td>
                      <td className="text-xs text-muted">{fmtDate(l.receivedAt)}</td>
                      <td>{l.certOnFile ? <Badge tone="green">on file</Badge> : <Badge tone="amber">missing</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState icon={Layers} title="No lots yet" hint="Receive a coil on the right — lot and heat numbers then follow the parts through jobs and shipments." />
          )}
        </Card>
        <Card title="Receive a coil / bundle">
          {materials.length ? (
            <form action={receiveLot} className="space-y-3">
              <Field label="Material"><select name="partId" className="select" required defaultValue="">{materials.map((m) => <option key={m.id} value={m.id}>{m.sku} · {m.name} ({num(m.quantityOnHand)} {m.unit})</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Lot / coil number"><input name="lotNumber" required className="input font-mono" placeholder="C-240917-1" /></Field>
                <Field label="Heat number"><input name="heatNumber" className="input font-mono" placeholder="H77410" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity"><input name="quantity" type="number" step="0.01" min={0} required className="input" placeholder="4200" /></Field>
                <Field label="Received"><input name="receivedAt" type="date" defaultValue={toDateInput(new Date())} className="input" /></Field>
              </div>
              <Field label="Supplier"><input name="supplier" className="input" placeholder="Steel service centre" /></Field>
              <Field label="Location"><input name="location" className="input" placeholder="Coil yard A3" /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="certOnFile" className="accent-emerald-500" /> Mill cert received</label>
              <Field label="Notes"><textarea name="notes" rows={2} className="textarea" placeholder="Spec, hardness, anything the operator should know" /></Field>
              <button className="btn btn-primary"><PackagePlus size={15} /> Receive lot</button>
              <p className="text-xs text-muted">Adds the quantity to the material&apos;s stock on hand.</p>
            </form>
          ) : (
            <p className="text-sm text-muted">Add a MATERIAL item under <Link href="/parts/new" className="text-accent">Parts</Link> first (coil, sheet, bar).</p>
          )}
        </Card>
      </div>
    </div>
  );
}
