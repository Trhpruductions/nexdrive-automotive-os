import Link from "next/link";
import { Save } from "lucide-react";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, Field, Flash, PageHeader } from "@/components/ui";
import { createJob } from "@/actions/production";

export const metadata = { title: "New job" };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ partId?: string; ok?: string; error?: string }> }) {
  await requireStaff(BILLING_ROLES);
  const sp = await searchParams;
  const [products, customers, presses, dies] = await Promise.all([
    db.part.findMany({ where: { kind: "PRODUCT", active: true }, orderBy: { name: "asc" }, include: { customer: { select: { id: true, company: true, firstName: true, lastName: true } } } }),
    db.customer.findMany({ orderBy: [{ company: "asc" }, { lastName: "asc" }], select: { id: true, company: true, firstName: true, lastName: true } }),
    db.machine.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    db.die.findMany({ where: { status: { not: "RETIRED" } }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  return (
    <div>
      <PageHeader title="New job" subtitle="A production order for one product. The press and die default from the product." crumbs={[{ label: "Jobs", href: "/jobs" }, { label: "New" }]} />
      <Flash searchParams={sp} />
      {!products.length ? (
        <Card><p className="text-sm text-muted">No products yet. <Link href="/parts/products/new" className="text-accent hover:underline">Add the parts you make</Link> first (part number, customer, die, press, material).</p></Card>
      ) : (
        <Card>
          <form action={createJob} className="grid sm:grid-cols-2 gap-4 max-w-3xl">
            <Field label="Product" className="sm:col-span-2">
              <select name="partId" required defaultValue={sp.partId ?? ""} className="select">
                <option value="" disabled>Choose a part number…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}{p.customer ? ` (${p.customer.company ?? `${p.customer.firstName} ${p.customer.lastName}`})` : ""}</option>)}
              </select>
            </Field>
            <Field label="Quantity"><input name="quantity" type="number" min={1} required className="input" placeholder="5000" /></Field>
            <Field label="Customer PO"><input name="customerPo" className="input" placeholder="Their purchase order #" /></Field>
            <Field label="Customer" hint="Blank = the product's customer">
              <select name="customerId" defaultValue="" className="select">
                <option value="">— product&apos;s customer —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.company ?? `${c.firstName} ${c.lastName}`}</option>)}
              </select>
            </Field>
            <Field label="Due date"><input name="dueAt" type="date" className="input" /></Field>
            <Field label="Press" hint="Blank = the product's default press">
              <select name="machineId" defaultValue="" className="select"><option value="">— default —</option>{presses.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select>
            </Field>
            <Field label="Die" hint="Blank = the product's die">
              <select name="dieId" defaultValue="" className="select"><option value="">— default —</option>{dies.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}</select>
            </Field>
            <Field label="Priority" hint="Higher runs first"><input name="priority" type="number" defaultValue={0} className="input" /></Field>
            <Field label="Notes" className="sm:col-span-2"><textarea name="notes" rows={2} className="textarea" placeholder="Packaging, special instructions, material lot…" /></Field>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <button className="btn btn-primary"><Save size={15} /> Create job</button>
              <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="release" defaultChecked className="accent-[var(--accent)]" /> Release to the floor now</label>
              <Link href="/jobs" className="btn btn-ghost">Cancel</Link>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
