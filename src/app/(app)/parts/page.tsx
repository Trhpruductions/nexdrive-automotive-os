import Link from "next/link";
import { AlertTriangle, ClipboardList, Download, Package, Plus, ScanBarcode, Truck } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, EmptyState, Flash, KpiCard, PageHeader } from "@/components/ui";
import { ListFilters, Pagination } from "@/components/app/search-bar";
import { money, num } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Boxes, DollarSign, Layers } from "lucide-react";

export const metadata = { title: "Parts & Inventory" };
const PAGE = 40;

export default async function PartsPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; category?: string; page?: string; ok?: string; error?: string }> }) {
  await requireStaff();
  const { modules } = await getSettings();
  const productsOn = modules.includes("jobs");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const filter = sp.filter ?? "all";
  const where = {
    ...(filter === "archived" ? { active: false } : { active: true }),
    ...(sp.category ? { category: sp.category } : {}),
    ...(q ? { OR: [{ sku: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }, { brand: { contains: q, mode: "insensitive" as const } }, { category: { contains: q, mode: "insensitive" as const } }, { location: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const [all, categories] = await Promise.all([
    db.part.findMany({ where, orderBy: [{ category: "asc" }, { name: "asc" }], include: { supplier: true } }),
    db.part.findMany({ where: { active: true, category: { not: null } }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
  ]);
  const filtered = filter === "low" ? all.filter((p) => p.quantityOnHand <= p.reorderPoint) : all;
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const lowCount = all.filter((p) => p.active && p.quantityOnHand <= p.reorderPoint).length;
  const stockValue = all.reduce((s, p) => s + Number(p.cost) * p.quantityOnHand, 0);
  const retailValue = all.reduce((s, p) => s + Number(p.price) * p.quantityOnHand, 0);

  return (
    <div>
      <PageHeader
        title="Parts & Inventory"
        subtitle={`${all.length} SKU${all.length === 1 ? "" : "s"} · ${num(all.reduce((s, p) => s + p.quantityOnHand, 0))} units on hand`}
        actions={
          <>
            <a href="/api/export/parts" className="btn btn-secondary" download><Download size={16} /> Export CSV</a>
            {productsOn ? <><Link href="/parts/lots" className="btn btn-secondary"><Layers size={16} /> Material lots</Link><Link href="/parts/products" className="btn btn-secondary"><Boxes size={16} /> Products</Link></> : null}
            <Link href="/parts/orders" className="btn btn-secondary"><ClipboardList size={16} /> Purchase orders</Link>
            <Link href="/parts/suppliers" className="btn btn-secondary"><Truck size={16} /> Suppliers</Link>
            <Link href="/parts/scan" className="btn btn-secondary"><ScanBarcode size={16} /> Scan</Link>
            <Link href="/parts/new" className="btn btn-primary"><Plus size={16} /> Add part</Link>
          </>
        }
      />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <KpiCard label="Low stock" value={lowCount} hint={lowCount ? "At or below reorder point — create a purchase order" : "All above reorder point"} icon={AlertTriangle} tone={lowCount ? "amber" : "green"} href={lowCount ? "/parts/orders/new" : "/parts?filter=low"} />
        <KpiCard label="Stock value (cost)" value={money(stockValue)} icon={Boxes} />
        <KpiCard label="Stock value (retail)" value={money(retailValue)} icon={DollarSign} tone="green" />
      </div>
      <div className="flex gap-1.5 pb-3 overflow-x-auto">
        {[{ key: "all", label: "Active" }, { key: "low", label: `Low stock (${lowCount})` }, { key: "archived", label: "Archived" }].map((t) => (
          <Link key={t.key} href={`/parts?filter=${t.key}`} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border ${filter === t.key ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-text"}`}>{t.label}</Link>
        ))}
        <span className="w-px bg-border mx-1" />
        {categories.map((c) => (
          <Link key={c.category} href={`/parts?category=${encodeURIComponent(c.category!)}`} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border ${sp.category === c.category ? "bg-card-hover border-border-strong" : "border-border text-muted hover:text-text"}`}>{c.category}</Link>
        ))}
      </div>
      <ListFilters action="/parts" q={q} placeholder="Search SKU, name, brand, bin location…" hidden={{ filter, category: sp.category }} />
      <Card padded={false}>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Part</th><th>Category</th><th>Location</th><th>Supplier</th><th className="text-right">On hand</th><th className="text-right">Reorder</th><th className="text-right">Cost</th><th className="text-right">Price</th></tr></thead>
              <tbody>
                {rows.map((p) => {
                  const low = p.quantityOnHand <= p.reorderPoint;
                  const critical = p.quantityOnHand <= Math.max(1, Math.floor(p.reorderPoint / 3));
                  return (
                    <tr key={p.id} className="row-link">
                      <td><Link href={`/parts/${p.id}`} className="font-medium hover:text-accent">{p.name}</Link><div className="text-[11px] font-mono text-faint">{p.sku}{p.brand ? ` · ${p.brand}` : ""}</div></td>
                      <td className="text-muted text-xs">{p.category ?? "—"}</td>
                      <td className="text-muted text-xs">{p.location ?? "—"}</td>
                      <td className="text-muted text-xs">{p.supplier?.name ?? "—"}</td>
                      <td className="text-right tabular-nums">{low ? <Badge tone={critical ? "red" : "amber"}>{p.quantityOnHand}</Badge> : p.quantityOnHand}</td>
                      <td className="text-right tabular-nums text-muted">{p.reorderPoint}</td>
                      <td className="text-right tabular-nums text-muted">{money(p.cost)}</td>
                      <td className="text-right tabular-nums">{money(p.price)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Package} title="No parts match" action={<Link href="/parts/new" className="btn btn-primary btn-sm">Add part</Link>} />
        )}
      </Card>
      <Pagination page={page} pages={Math.ceil(filtered.length / PAGE)} base={`/parts?filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
    </div>
  );
}
