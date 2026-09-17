import Link from "next/link";
import { Car, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { ListFilters, Pagination } from "@/components/app/search-bar";
import { WO_STATUS } from "@/lib/constants";
import { fmtDate, num } from "@/lib/format";

export const metadata = { title: "Vehicles" };
const PAGE = 25;

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; ok?: string; error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const yr = Number(q);
  const where = q
    ? {
        OR: [
          { make: { contains: q, mode: "insensitive" as const } },
          { model: { contains: q, mode: "insensitive" as const } },
          { vin: { contains: q, mode: "insensitive" as const } },
          { licensePlate: { contains: q, mode: "insensitive" as const } },
          { customer: { OR: [{ firstName: { contains: q, mode: "insensitive" as const } }, { lastName: { contains: q, mode: "insensitive" as const } }] } },
          ...(Number.isInteger(yr) && yr > 1900 ? [{ year: yr }] : []),
        ],
      }
    : {};
  const [total, vehicles] = await Promise.all([
    db.vehicle.count({ where }),
    db.vehicle.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { customer: true, workOrders: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true, id: true } } },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Vehicles" subtitle={`${total} vehicle${total === 1 ? "" : "s"} on file`} actions={<Link href="/vehicles/new" className="btn btn-primary"><Plus size={16} /> Add vehicle</Link>} />
      <Flash searchParams={sp} />
      <ListFilters action="/vehicles" q={q} placeholder="Search make, model, year, plate, VIN, owner…" />
      <Card padded={false}>
        {vehicles.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Vehicle</th><th>Plate / VIN</th><th>Owner</th><th className="text-right">Mileage</th><th>Last service</th><th>Status</th></tr></thead>
              <tbody>
                {vehicles.map((v) => {
                  const last = v.workOrders[0];
                  return (
                    <tr key={v.id} className="row-link">
                      <td>
                        <Link href={`/vehicles/${v.id}`} className="font-medium hover:text-accent">{v.year} {v.make} {v.model}</Link>
                        <div className="text-xs text-muted">{[v.trim, v.color].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="text-muted"><div>{v.licensePlate ?? "—"}{v.plateState ? <span className="text-faint"> {v.plateState}</span> : null}</div><div className="text-[11px] font-mono text-faint">{v.vin ?? ""}</div></td>
                      <td><Link href={`/customers/${v.customer.id}`} className="hover:text-accent">{v.customer.firstName} {v.customer.lastName}</Link></td>
                      <td className="text-right tabular-nums">{num(v.mileage)}</td>
                      <td className="text-muted text-xs">{last ? fmtDate(last.createdAt) : "—"}</td>
                      <td>{last && !["INVOICED", "CANCELLED"].includes(last.status) ? <Badge tone={WO_STATUS[last.status].tone}>{WO_STATUS[last.status].label}</Badge> : <span className="text-xs text-faint">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Car} title={q ? "No vehicles match" : "No vehicles yet"} action={<Link href="/vehicles/new" className="btn btn-primary btn-sm">Add vehicle</Link>} />
        )}
      </Card>
      <Pagination page={page} pages={Math.ceil(total / PAGE)} base={`/vehicles${q ? `?q=${encodeURIComponent(q)}` : ""}`} />
    </div>
  );
}
