import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { ListFilters, Pagination } from "@/components/app/search-bar";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Customers" };
const PAGE = 25;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; ok?: string; error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
          { company: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
          { vehicles: { some: { OR: [{ licensePlate: { contains: q, mode: "insensitive" as const } }, { vin: { contains: q, mode: "insensitive" as const } }] } } },
        ],
      }
    : {};
  const [total, customers] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { vehicles: { select: { id: true, year: true, make: true, model: true } }, portalUser: { select: { id: true } }, _count: { select: { workOrders: true } }, workOrders: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${total} customer${total === 1 ? "" : "s"}`}
        actions={
          <Link href="/customers/new" className="btn btn-primary">
            <Plus size={16} /> New customer
          </Link>
        }
      />
      <Flash searchParams={sp} />
      <ListFilters action="/customers" q={q} placeholder="Search name, company, email, phone, plate, VIN…" />
      <Card padded={false}>
        {customers.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Vehicles</th>
                  <th className="text-right">Work orders</th>
                  <th>Last visit</th>
                  <th>Portal</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="row-link">
                    <td>
                      <Link href={`/customers/${c.id}`} className="font-medium hover:text-accent">
                        {c.firstName} {c.lastName}
                      </Link>
                      {c.company ? <div className="text-xs text-muted">{c.company}</div> : null}
                    </td>
                    <td className="text-muted">
                      <div>{c.phone ?? "—"}</div>
                      <div className="text-xs">{c.email ?? ""}</div>
                    </td>
                    <td className="text-muted">
                      {c.vehicles.slice(0, 2).map((v) => (
                        <div key={v.id} className="text-xs">
                          <Link href={`/vehicles/${v.id}`} className="hover:text-accent">{v.year} {v.make} {v.model}</Link>
                        </div>
                      ))}
                      {c.vehicles.length > 2 ? <div className="text-xs text-faint">+{c.vehicles.length - 2} more</div> : null}
                      {!c.vehicles.length ? "—" : null}
                    </td>
                    <td className="text-right tabular-nums">{c._count.workOrders}</td>
                    <td className="text-muted text-xs">{c.workOrders[0] ? fmtDate(c.workOrders[0].createdAt) : "—"}</td>
                    <td>{c.portalUser ? <Badge tone="green">Active</Badge> : <span className="text-xs text-faint">None</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Users} title={q ? "No customers match" : "No customers yet"} hint={q ? "Try a different search." : "Add your first customer to get started."} action={<Link href="/customers/new" className="btn btn-primary btn-sm">New customer</Link>} />
        )}
      </Card>
      <Pagination page={page} pages={Math.ceil(total / PAGE)} base={`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`} />
    </div>
  );
}
