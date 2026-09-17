import Link from "next/link";
import { Building2, CalendarClock, ExternalLink, Plus, Users } from "lucide-react";
import { subDays } from "date-fns";
import { requireSuperadmin } from "@/lib/auth";
import { rawDb } from "@/lib/db";
import { Badge, Card, Flash, KpiCard, PageHeader } from "@/components/ui";
import { adminCreateShop, adminOpenShop } from "@/actions/platform";
import { fmtDate, fmtRelative } from "@/lib/format";
import type { ShopStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Shops" };

const STATUS_TONE: Record<ShopStatus, "green" | "blue" | "amber" | "red" | "slate"> = { ACTIVE: "green", TRIAL: "blue", PAST_DUE: "amber", SUSPENDED: "red", CANCELLED: "slate" };

export default async function AdminShopsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; q?: string }> }) {
  await requireSuperadmin();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const [shops, totals, active7d, leads] = await Promise.all([
    rawDb.shop.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }, { ownerEmail: { contains: q, mode: "insensitive" } }] } : {},
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true, workOrders: true, customers: true } } },
    }),
    rawDb.shop.groupBy({ by: ["status"], _count: { _all: true } }),
    rawDb.auditLog.groupBy({ by: ["shopId"], where: { createdAt: { gte: subDays(new Date(), 7) }, shopId: { not: null } } }),
    rawDb.lead.count({ where: { handled: false } }),
  ]);
  const count = (s: ShopStatus) => totals.find((t) => t.status === s)?._count._all ?? 0;

  return (
    <div>
      <PageHeader title="Shops" subtitle={`${shops.length} shop${shops.length === 1 ? "" : "s"} on the platform`} />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Active shops" value={count("ACTIVE")} hint={`${count("TRIAL")} on trial · ${count("PAST_DUE")} past due`} icon={Building2} tone="green" />
        <KpiCard label="Active in last 7 days" value={active7d.length} hint="shops with staff activity" icon={Users} />
        <KpiCard label="Suspended / cancelled" value={count("SUSPENDED") + count("CANCELLED")} icon={CalendarClock} tone={count("SUSPENDED") ? "red" : "slate"} />
        <KpiCard label="Open leads" value={leads} hint="demo requests to follow up" icon={Users} tone="amber" href="/admin/leads" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="Create a shop">
          <form action={adminCreateShop} className="space-y-3">
            <input name="name" required placeholder="Shop name" className="input" />
            <input name="ownerName" required placeholder="Owner name" className="input" />
            <input name="ownerEmail" type="email" required placeholder="Owner email (their login)" className="input" />
            <input name="password" type="password" required minLength={8} placeholder="Temporary password (8+)" className="input" autoComplete="new-password" />
            <select name="plan" className="select" defaultValue="TRIAL">
              {["TRIAL", "STARTER", "PRO", "ENTERPRISE"].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
            </select>
            <button className="btn btn-primary w-full"><Plus size={15} /> Create shop</button>
          </form>
          <p className="text-xs text-faint mt-3">Shops can also self-serve at <Link href="/signup" className="text-accent">/signup</Link> (14-day trial).</p>
        </Card>

        <Card className="xl:col-span-2" title="All shops" action={<form action="/admin" method="get"><input name="q" defaultValue={q} placeholder="Search…" className="input py-1 text-xs w-44" /></form>} padded={false}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Shop</th><th>Plan</th><th>Status</th><th className="text-right">Users</th><th className="text-right">Work orders</th><th>Trial ends</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {shops.map((s) => (
                  <tr key={s.id} className="row-link">
                    <td><Link href={`/admin/shops/${s.id}`} className="font-medium hover:text-accent">{s.name}</Link><div className="text-xs text-muted">{s.slug} · {s.ownerEmail ?? "no owner"}</div></td>
                    <td><Badge tone="violet">{s.plan.toLowerCase()}</Badge></td>
                    <td><Badge tone={STATUS_TONE[s.status]}>{s.status.replace("_", " ").toLowerCase()}</Badge></td>
                    <td className="text-right tabular-nums">{s._count.users}</td>
                    <td className="text-right tabular-nums">{s._count.workOrders}</td>
                    <td className="text-xs text-muted">{s.trialEndsAt ? (s.trialEndsAt < new Date() ? <span className="text-red-400">ended {fmtRelative(s.trialEndsAt)}</span> : fmtDate(s.trialEndsAt)) : "—"}</td>
                    <td className="text-xs text-muted">{fmtDate(s.createdAt)}</td>
                    <td className="text-right"><form action={adminOpenShop.bind(null, s.id)}><button className="btn btn-secondary btn-sm"><ExternalLink size={12} /> Open</button></form></td>
                  </tr>
                ))}
                {!shops.length ? <tr><td colSpan={8} className="text-center text-muted py-8">No shops match.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
