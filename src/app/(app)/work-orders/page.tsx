import Link from "next/link";
import { ClipboardList, Download, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Avatar, Badge, Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { ListFilters, Pagination } from "@/components/app/search-bar";
import { WO_STATUS, WO_STATUS_ORDER } from "@/lib/constants";
import { computeTotals } from "@/lib/money";
import { fmtDate, fmtRelative, money, vehicleName, woNumber } from "@/lib/format";
import type { WorkOrderStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Work Orders" };
const PAGE = 25;
const ACTIVE: WorkOrderStatus[] = ["APPROVED", "IN_PROGRESS", "ON_HOLD", "AWAITING_APPROVAL"];

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; tech?: string; page?: string; ok?: string; error?: string }> }) {
  const user = await requireStaff();
  const settings = await getSettings();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status ?? "open";

  const statusWhere =
    status === "all" ? {} : status === "open" ? { status: { notIn: ["INVOICED", "CANCELLED"] as WorkOrderStatus[] } } : status === "active" ? { status: { in: ACTIVE } } : (WO_STATUS_ORDER as string[]).includes(status) ? { status: status as WorkOrderStatus } : {};
  const techWhere = sp.tech === "me" && user.technicianId ? { technicianId: user.technicianId } : sp.tech ? { technicianId: sp.tech } : {};
  const num = Number(q.replace(/^wo-?/i, ""));
  const where = {
    ...statusWhere,
    ...techWhere,
    ...(q
      ? {
          OR: [
            ...(Number.isInteger(num) && num > 0 ? [{ number: num }] : []),
            { complaint: { contains: q, mode: "insensitive" as const } },
            { customer: { OR: [{ firstName: { contains: q, mode: "insensitive" as const } }, { lastName: { contains: q, mode: "insensitive" as const } }] } },
            { vehicle: { OR: [{ make: { contains: q, mode: "insensitive" as const } }, { model: { contains: q, mode: "insensitive" as const } }, { licensePlate: { contains: q, mode: "insensitive" as const } }] } },
          ],
        }
      : {}),
  };

  const [total, rows, techs, counts] = await Promise.all([
    db.workOrder.count({ where }),
    db.workOrder.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { customer: true, vehicle: true, technician: true, lines: true, bay: true } }),
    db.technician.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.workOrder.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countOf = (s: WorkOrderStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;

  const base = `/work-orders?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}${sp.tech ? `&tech=${sp.tech}` : ""}`;

  return (
    <div>
      <PageHeader title="Work Orders" subtitle={`${total} ${status === "open" ? "open" : status === "all" ? "total" : ""} work order${total === 1 ? "" : "s"}`} actions={<><a href="/api/export/work-orders" className="btn btn-secondary" download><Download size={16} /> Export CSV</a><Link href="/work-orders/new" className="btn btn-primary"><Plus size={16} /> New work order</Link></>} />
      <Flash searchParams={sp} />

      <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1">
        {[
          { key: "open", label: "Open" },
          { key: "active", label: "In shop" },
          ...WO_STATUS_ORDER.map((s) => ({ key: s, label: `${WO_STATUS[s].label} (${countOf(s)})` })),
          { key: "all", label: "All" },
        ].map((t) => (
          <Link key={t.key} href={`/work-orders?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border ${status === t.key ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-text"}`}>
            {t.label}
          </Link>
        ))}
      </div>

      <ListFilters action="/work-orders" q={q} placeholder="Search WO #, customer, vehicle, plate, complaint…" hidden={{ status }}>
        <select name="tech" defaultValue={sp.tech ?? ""} className="select w-44">
          <option value="">All technicians</option>
          {user.technicianId ? <option value="me">Assigned to me</option> : null}
          {techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </ListFilters>

      <Card padded={false}>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Work order</th><th>Vehicle / customer</th><th>Status</th><th>Technician</th><th>Promised</th><th className="text-right">Total</th><th>Updated</th></tr></thead>
              <tbody>
                {rows.map((w) => {
                  const t = computeTotals(w.lines, settings.taxRate, { taxExempt: w.customer.taxExempt });
                  const late = w.promisedAt && w.promisedAt < new Date() && !["COMPLETED", "INVOICED", "CANCELLED"].includes(w.status);
                  return (
                    <tr key={w.id} className="row-link">
                      <td><Link href={`/work-orders/${w.id}`} className="font-semibold hover:text-accent">{woNumber(w.number)}</Link><div className="text-xs text-muted truncate max-w-[260px]">{w.complaint}</div></td>
                      <td><Link href={`/vehicles/${w.vehicleId}`} className="hover:text-accent">{vehicleName(w.vehicle)}</Link><div className="text-xs text-muted">{w.customer.firstName} {w.customer.lastName}{w.bay ? ` · ${w.bay.name}` : ""}</div></td>
                      <td><Badge tone={WO_STATUS[w.status].tone}>{WO_STATUS[w.status].label}</Badge></td>
                      <td>{w.technician ? <span className="flex items-center gap-2 text-sm"><Avatar name={w.technician.name} color={w.technician.color} size={22} />{w.technician.name.split(" ")[0]}</span> : <span className="text-faint text-xs">Unassigned</span>}</td>
                      <td className={`text-xs ${late ? "text-red-400 font-semibold" : "text-muted"}`}>{w.promisedAt ? fmtDate(w.promisedAt) : "—"}{late ? " · late" : ""}</td>
                      <td className="text-right tabular-nums font-medium">{money(t.total)}</td>
                      <td className="text-xs text-muted">{fmtRelative(w.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={ClipboardList} title="No work orders here" hint="Try another filter or start a new work order." action={<Link href="/work-orders/new" className="btn btn-primary btn-sm">New work order</Link>} />
        )}
      </Card>
      <Pagination page={page} pages={Math.ceil(total / PAGE)} base={base} />
    </div>
  );
}
