import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Avatar, Card, EmptyState, PageHeader } from "@/components/ui";
import { ListFilters, Pagination } from "@/components/app/search-bar";
import { INSPECTION_RESULT } from "@/lib/constants";
import { fmtDateTime, vehicleName, woNumber } from "@/lib/format";

export const metadata = { title: "Inspections" };
const PAGE = 25;

export default async function InspectionsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where = q
    ? { OR: [{ vehicle: { OR: [{ make: { contains: q, mode: "insensitive" as const } }, { model: { contains: q, mode: "insensitive" as const } }, { licensePlate: { contains: q, mode: "insensitive" as const } }] } }, { workOrder: { customer: { OR: [{ firstName: { contains: q, mode: "insensitive" as const } }, { lastName: { contains: q, mode: "insensitive" as const } }] } } }] }
    : {};
  const [total, rows] = await Promise.all([
    db.inspection.count({ where }),
    db.inspection.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { vehicle: true, technician: true, items: true, workOrder: { include: { customer: true } } } }),
  ]);

  return (
    <div>
      <PageHeader title="Inspections" subtitle="Digital multi-point inspections. Start one from any work order." />
      <ListFilters action="/inspections" q={q} placeholder="Search vehicle, plate, customer…" />
      <Card padded={false}>
        {rows.length ? (
          <table className="table">
            <thead><tr><th>Vehicle</th><th>Work order</th><th>Technician</th><th>Results</th><th>Date</th></tr></thead>
            <tbody>
              {rows.map((i) => {
                const counts = { GOOD: 0, ATTENTION: 0, URGENT: 0, NA: 0 };
                for (const it of i.items) counts[it.result]++;
                const done = i.items.length - counts.NA;
                return (
                  <tr key={i.id} className="row-link">
                    <td><Link href={`/inspections/${i.id}`} className="font-medium hover:text-accent">{vehicleName(i.vehicle)}</Link><div className="text-xs text-muted">{i.workOrder.customer.firstName} {i.workOrder.customer.lastName}</div></td>
                    <td><Link href={`/work-orders/${i.workOrderId}`} className="hover:text-accent">{woNumber(i.workOrder.number)}</Link></td>
                    <td>{i.technician ? <span className="flex items-center gap-2"><Avatar name={i.technician.name} color={i.technician.color} size={22} /> {i.technician.name}</span> : <span className="text-faint">—</span>}</td>
                    <td>
                      <div className="flex items-center gap-3 text-xs">
                        {(["GOOD", "ATTENTION", "URGENT"] as const).map((k) => <span key={k} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${INSPECTION_RESULT[k].dot}`} />{counts[k]}</span>)}
                        <span className="text-faint">{done}/{i.items.length} checked</span>
                      </div>
                    </td>
                    <td className="text-xs text-muted">{fmtDateTime(i.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={ClipboardCheck} title="No inspections yet" hint="Open a work order and click “Start inspection”." />
        )}
      </Card>
      <Pagination page={page} pages={Math.ceil(total / PAGE)} base={`/inspections${q ? `?q=${encodeURIComponent(q)}` : ""}`} />
    </div>
  );
}
