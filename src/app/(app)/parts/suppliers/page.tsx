import { Plus, Trash2, Truck } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { createSupplier, deleteSupplier } from "@/actions/parts";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const suppliers = await db.supplier.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { parts: true } } } });
  return (
    <div>
      <PageHeader title="Suppliers" crumbs={[{ label: "Parts & Inventory", href: "/parts" }, { label: "Suppliers" }]} />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Add / update supplier">
          <form action={createSupplier} className="space-y-3">
            <input name="name" required placeholder="Supplier name" className="input" />
            <input name="phone" placeholder="Phone" className="input" />
            <input name="email" type="email" placeholder="Email" className="input" />
            <input name="website" placeholder="Website / ordering portal" className="input" />
            <button className="btn btn-primary w-full"><Plus size={15} /> Save supplier</button>
          </form>
        </Card>
        <Card className="lg:col-span-2" padded={false}>
          {suppliers.length ? (
            <table className="table">
              <thead><tr><th>Supplier</th><th>Contact</th><th className="text-right">Parts</th><th></th></tr></thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.name}{s.website ? <div className="text-xs"><a href={s.website} target="_blank" rel="noreferrer" className="text-accent hover:underline">{s.website}</a></div> : null}</td>
                    <td className="text-xs text-muted">{[s.phone, s.email].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="text-right tabular-nums">{s._count.parts}</td>
                    <td className="text-right"><form action={deleteSupplier.bind(null, s.id)}><ConfirmButton message="Remove this supplier? Parts keep their data." className="btn btn-ghost btn-sm text-faint hover:text-red-400"><Trash2 size={13} /></ConfirmButton></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState icon={Truck} title="No suppliers yet" />
          )}
        </Card>
      </div>
    </div>
  );
}
