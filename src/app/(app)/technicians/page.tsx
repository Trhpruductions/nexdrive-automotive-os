import Link from "next/link";
import { Plus, Wrench } from "lucide-react";
import { differenceInMinutes, startOfDay, startOfWeek } from "date-fns";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Avatar, Badge, EmptyState, Flash, PageHeader, Progress } from "@/components/ui";
import { money, num } from "@/lib/format";

export const metadata = { title: "Technicians" };

export default async function TechniciansPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireStaff(BILLING_ROLES);
  const sp = await searchParams;
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const techs = await db.technician.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      user: { select: { email: true, active: true } },
      timeEntries: { where: { startedAt: { gte: weekStart } } },
      workOrders: { where: { status: { in: ["APPROVED", "IN_PROGRESS", "ON_HOLD"] } }, select: { id: true } },
      _count: { select: { workOrders: true } },
    },
  });
  const billed = await db.workOrderLine.findMany({ where: { kind: "LABOR", approved: true, workOrder: { technicianId: { not: null }, status: "INVOICED", completedAt: { gte: weekStart } } }, select: { hours: true, quantity: true, unitPrice: true, workOrder: { select: { technicianId: true } } } });

  return (
    <div>
      <PageHeader title="Technicians" subtitle="Team, rates, logins and this week's utilisation" actions={<Link href="/technicians/new" className="btn btn-primary"><Plus size={16} /> Add technician</Link>} />
      <Flash searchParams={sp} />
      {techs.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {techs.map((t) => {
            const minsWeek = t.timeEntries.reduce((s, e) => s + differenceInMinutes(e.endedAt ?? now, e.startedAt), 0);
            const minsToday = t.timeEntries.filter((e) => e.startedAt >= startOfDay(now)).reduce((s, e) => s + differenceInMinutes(e.endedAt ?? now, e.startedAt), 0);
            const mine = billed.filter((b) => b.workOrder.technicianId === t.id);
            const billedHours = mine.reduce((s, b) => s + Number(b.hours ?? b.quantity), 0);
            const billedRevenue = mine.reduce((s, b) => s + Number(b.hours ?? b.quantity) * Number(b.unitPrice), 0);
            const efficiency = minsWeek > 0 ? billedHours / (minsWeek / 60) : 0;
            const clockedIn = t.timeEntries.some((e) => !e.endedAt);
            return (
              <Link key={t.id} href={`/technicians/${t.id}`} className={`card card-hover p-5 transition-colors ${!t.active ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-3">
                  <Avatar name={t.name} color={t.color} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold flex items-center gap-2">{t.name} {clockedIn ? <Badge tone="green">On the clock</Badge> : null}{!t.active ? <Badge tone="slate">Inactive</Badge> : null}</div>
                    <div className="text-xs text-muted truncate">{t.specialty ?? "General technician"}{t.user ? ` · ${t.user.email}` : " · no login"}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                  <div><div className="text-lg font-semibold tabular-nums">{(minsToday / 60).toFixed(1)}</div><div className="text-[10px] uppercase tracking-wider text-muted">hrs today</div></div>
                  <div><div className="text-lg font-semibold tabular-nums">{t.workOrders.length}</div><div className="text-[10px] uppercase tracking-wider text-muted">active jobs</div></div>
                  <div><div className="text-lg font-semibold tabular-nums">{money(billedRevenue)}</div><div className="text-[10px] uppercase tracking-wider text-muted">labor / wk</div></div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-[11px] text-muted mb-1"><span>Efficiency (billed ÷ clocked, this week)</span><span>{Math.round(Math.min(efficiency, 1.5) * 100)}%</span></div>
                  <Progress value={Math.min(efficiency, 1)} tone={efficiency >= 0.85 ? "green" : efficiency >= 0.6 ? "blue" : "amber"} />
                </div>
                <div className="mt-3 text-[11px] text-faint">{num(t._count.workOrders)} jobs lifetime · {money(t.hourlyRate)}/hr</div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Wrench} title="No technicians yet" action={<Link href="/technicians/new" className="btn btn-primary btn-sm">Add technician</Link>} />
      )}
    </div>
  );
}
