import Link from "next/link";
import { AlertTriangle, Calendar, Car, CheckCircle2, ChevronDown, CircleDollarSign, ClipboardList, Clock, PackageSearch, Timer, TriangleAlert } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getDashboard, type Range } from "@/lib/dashboard";
import { Avatar, Badge, Card, KpiCard, Progress, ViewAll } from "@/components/ui";
import { RevenueChart } from "@/components/app/revenue-chart";
import { BayTimeline } from "@/components/app/bay-timeline";
import { WO_STATUS } from "@/lib/constants";
import { computeTotals } from "@/lib/money";
import { fmtDay, greeting, money, vehicleName, woNumber } from "@/lib/format";
import { format } from "date-fns";
import { TechDashboard } from "./tech-dashboard";
import { OnboardingChecklist } from "@/components/app/onboarding";
import { Flash } from "@/components/ui";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string; denied?: string; welcome?: string; ok?: string; error?: string }> }) {
  const user = await requireStaff();
  const settings = await getSettings();
  const sp = await searchParams;
  if (user.role === "TECHNICIAN" && user.technicianId) {
    return (
      <div>
        <Flash searchParams={sp} />
        {sp.denied ? <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">You don&apos;t have access to that page.</div> : null}
        <TechDashboard technicianId={user.technicianId} userName={user.name} />
      </div>
    );
  }
  const range: Range = sp.range === "daily" || sp.range === "weekly" ? sp.range : "monthly";
  const d = await getDashboard(range);
  const mod = (k: string) => settings.modules.includes(k as never);

  return (
    <div className="space-y-5">
      {sp.denied ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">You don&apos;t have access to that page.</div> : null}
      <OnboardingChecklist settings={settings} role={user.role} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {user.name}
        </h1>
        <p className="text-sm text-muted mt-1">Here&apos;s what&apos;s happening with {settings.name} today.</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        <KpiCard label="Appointments" value={d.kpis.appointmentsToday} hint="Today" icon={Calendar} href="/schedule" />
        <KpiCard label={settings.terms.inShop} value={d.kpis.inShop} hint="In progress" icon={Car} href="/work-orders?status=active" />
        <KpiCard label="Open Work Orders" value={d.kpis.openWorkOrders} hint="Open" icon={ClipboardList} href="/work-orders" />
        <KpiCard label="Awaiting Approval" value={d.kpis.awaitingApproval} hint="Waiting" icon={Clock} tone="amber" href="/estimates" />
        <div className="col-span-2 md:col-span-1">
          <KpiCard label="Today's Revenue" value={money(d.revenue.today)} icon={CircleDollarSign} tone="green" href="/payments" delta={{ value: d.revenue.deltaVsYesterday, label: "vs yesterday" }} />
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card
          className="xl:col-span-4"
          title="Revenue Overview"
          action={
            <div className="flex items-center gap-1 text-xs">
              {(["daily", "weekly", "monthly"] as Range[]).map((r) => (
                <Link key={r} href={`/dashboard?range=${r}`} className={`rounded-md px-2 py-1 capitalize ${range === r ? "bg-card-hover text-text" : "text-muted hover:text-text"}`}>
                  {r}
                </Link>
              ))}
              <ChevronDown size={12} className="text-faint" />
            </div>
          }
        >
          <div className="text-[26px] font-semibold tracking-tight leading-none">{money(d.revenue.range)}</div>
          <div className="text-xs text-muted mt-1 mb-3">{d.revenue.rangeLabel} · collected payments</div>
          <RevenueChart series={d.revenue.series} />
        </Card>

        <Card className="xl:col-span-2" title="Shop Activity">
          <ul className="space-y-3">
            {[
              { label: "Completed Today", value: d.kpis.completedToday, Icon: CheckCircle2, cls: "text-emerald-400 bg-emerald-500/15", href: "/work-orders?status=COMPLETED" },
              { label: "In Progress", value: d.kpis.inProgress, Icon: Timer, cls: "text-accent bg-accent-soft", href: "/work-orders?status=IN_PROGRESS" },
              { label: "Awaiting Approval", value: d.kpis.awaitingApproval, Icon: Clock, cls: "text-amber-400 bg-amber-500/15", href: "/work-orders?status=AWAITING_APPROVAL" },
              { label: "Waiting Parts", value: d.kpis.waitingParts, Icon: PackageSearch, cls: "text-orange-400 bg-orange-500/15", href: "/work-orders?status=ON_HOLD" },
              { label: "Scheduled", value: d.kpis.scheduled, Icon: Calendar, cls: "text-violet-400 bg-violet-500/15", href: "/schedule" },
            ].map(({ label, value, Icon, cls, href }) => (
              <li key={label}>
                <Link href={href} className="flex items-center gap-2.5 rounded-lg -mx-2 px-2 py-1.5 hover:bg-card-hover">
                  <span className={`h-7 w-7 shrink-0 rounded-lg grid place-items-center ${cls}`}>
                    <Icon size={14} />
                  </span>
                  <span className="text-[13px] flex-1 whitespace-nowrap">{label}</span>
                  <span className="text-lg font-semibold tabular-nums">{value}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-3" title="Top Technicians" action={<span className="text-xs text-muted">Today</span>}>
          <ul className="space-y-3.5">
            {d.techStats.slice(0, 5).map((t) => (
              <li key={t.id}>
                <Link href={`/technicians/${t.id}`} className="block group">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={t.name} color={t.color} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate group-hover:text-accent">{t.name}</span>
                        <span className="text-xs text-muted tabular-nums">{t.hours.toFixed(1)} hrs</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Progress value={t.utilisation} />
                        <span className="text-[11px] text-muted tabular-nums w-8 text-right">{Math.round(t.utilisation * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            {!d.techStats.length ? <li className="text-sm text-muted">No technicians yet.</li> : null}
          </ul>
        </Card>

        <Card className="xl:col-span-3" title="Recent Work Orders" action={<ViewAll href="/work-orders" />}>
          <ul className="divide-y divide-border -my-2">
            {d.recentWorkOrders.map((w) => {
              const t = computeTotals(w.lines, settings.taxRate, { taxExempt: w.customer.taxExempt });
              const s = WO_STATUS[w.status];
              return (
                <li key={w.id}>
                  <Link href={`/work-orders/${w.id}`} className="flex items-start justify-between gap-3 py-2.5 group">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold group-hover:text-accent">{woNumber(w.number)}</div>
                      <div className="text-xs text-muted truncate">{vehicleName(w.vehicle)}</div>
                      <div className="mt-1"><Badge tone={s.tone}>• {s.label}</Badge></div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums shrink-0">{money(t.total)}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card
          className="xl:col-span-8"
          title="Schedule Overview"
          action={
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>{format(new Date(), "MMM d, yyyy")} · {fmtDay(new Date())}</span>
              <ViewAll href="/schedule" label="Open schedule" />
            </div>
          }
        >
          <BayTimeline appointments={d.todaysAppointments} bays={d.bays} open={d.open} close={d.close} />
          {!d.todaysAppointments.length ? <p className="text-sm text-muted mt-3">No appointments today. <Link href="/schedule/new" className="text-accent">Book one</Link>.</p> : null}
        </Card>

        <Card className="xl:col-span-4" title="Inventory Alerts" action={<ViewAll href="/parts?filter=low" />}>
          {d.lowStock.length ? (
            <ul className="divide-y divide-border -my-1">
              {d.lowStock.map((p) => {
                const critical = p.quantityOnHand <= Math.max(1, Math.floor(p.reorderPoint / 3));
                return (
                  <li key={p.id}>
                    <Link href={`/parts/${p.id}`} className="flex items-center gap-3 py-2.5 group">
                      <span className="h-9 w-9 rounded-lg bg-card-hover grid place-items-center text-muted">
                        <PackageSearch size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate group-hover:text-accent">{p.name}</div>
                        <div className={`text-xs ${critical ? "text-red-400" : "text-amber-400"}`}>
                          Only {p.quantityOnHand} left in stock <span className="text-faint">· reorder at {p.reorderPoint}</span>
                        </div>
                      </div>
                      {critical ? <AlertTriangle size={16} className="text-red-400" /> : <TriangleAlert size={16} className="text-amber-400" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">All parts are above their reorder points.</p>
          )}
        </Card>
      </div>

      {/* Feature strip (from the mockup) */}
      {mod("workOrders") ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: "Work Orders", text: "Manage repairs from start to finish", href: "/work-orders", key: "workOrders" },
            { label: "Estimates", text: "Create & send professional estimates", href: "/estimates", key: "estimates" },
            { label: "Invoices", text: "Fast, accurate billing & payments", href: "/invoices", key: "invoices" },
            { label: "Inspections", text: "Digital inspection with photos & reports", href: "/inspections", key: "inspections" },
            { label: "Customer Portal", text: "Customers approve estimates & view history", href: "/customers", key: "customers" },
            { label: "NexDrive AI", text: "Your AI assistant for smarter shop management", href: "/ai", key: "ai" },
          ]
            .filter((f) => mod(f.key))
            .map((f) => (
              <Link key={f.key} href={f.href} className="card card-hover p-4 transition-colors">
                <div className="text-[13px] font-bold tracking-wide text-accent uppercase">{f.label}</div>
                <div className="text-xs text-muted mt-1 leading-relaxed">{f.text}</div>
              </Link>
            ))}
        </div>
      ) : null}
    </div>
  );
}
