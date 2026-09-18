import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, KeyRound, Save, Trash2 } from "lucide-react";
import { subDays } from "date-fns";
import { requireSuperadmin } from "@/lib/auth";
import { rawDb } from "@/lib/db";
import { Badge, Card, Field, Flash, PageHeader, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { adminDeleteShop, adminExtendTrial, adminOpenShop, adminResetOwnerPassword, adminUpdateShop } from "@/actions/platform";
import { adminAddLocation, adminGrantAccess, adminRevokeAccess } from "@/actions/locations";
import { ROLE_LABEL } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtRelative, money, toDateInput } from "@/lib/format";

export default async function AdminShopPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireSuperadmin();
  const { id } = await params;
  const sp = await searchParams;
  const shop = await rawDb.shop.findUnique({
    where: { id },
    include: {
      settings: true,
      users: { where: { role: { not: "CUSTOMER" } }, orderBy: { createdAt: "asc" } },
      members: { include: { user: { select: { id: true, name: true, email: true, shop: { select: { name: true } } } } }, orderBy: { createdAt: "asc" } },
      _count: { select: { customers: true, vehicles: true, workOrders: true, invoices: true, apiKeys: true, integrations: true, machines: true } },
    },
  });
  if (!shop) notFound();
  const [revenue30, lastActivity, portalUsers] = await Promise.all([
    rawDb.payment.aggregate({ _sum: { amount: true }, where: { invoice: { shopId: id }, paidAt: { gte: subDays(new Date(), 30) } } }),
    rawDb.auditLog.findFirst({ where: { shopId: id }, orderBy: { createdAt: "desc" } }),
    rawDb.user.count({ where: { shopId: id, role: "CUSTOMER" } }),
  ]);

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3">{shop.name} <Badge tone={shop.status === "ACTIVE" ? "green" : shop.status === "TRIAL" ? "blue" : shop.status === "PAST_DUE" ? "amber" : "red"}>{shop.status.replace("_", " ").toLowerCase()}</Badge><Badge tone="violet">{shop.plan.toLowerCase()}</Badge></span>}
        subtitle={`${shop.slug} · created ${fmtDate(shop.createdAt)} · owner ${shop.ownerEmail ?? "—"}`}
        crumbs={[{ label: "Shops", href: "/admin" }, { label: shop.name }]}
        actions={<form action={adminOpenShop.bind(null, shop.id)}><button className="btn btn-primary"><ExternalLink size={15} /> Open shop</button></form>}
      />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card title="Usage">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Customers" value={shop._count.customers} />
              <Stat label="Vehicles" value={shop._count.vehicles} />
              <Stat label="Work orders" value={shop._count.workOrders} />
              <Stat label="Invoices" value={shop._count.invoices} />
              <Stat label="Collected (30d)" value={money(revenue30._sum.amount ?? 0)} />
              <Stat label="Portal logins" value={portalUsers} />
              <Stat label="API keys / feeds" value={`${shop._count.apiKeys} / ${shop._count.integrations}`} />
              <Stat label="Machines" value={shop._count.machines} />
              <Stat label="Last activity" value={lastActivity ? fmtRelative(lastActivity.createdAt) : "never"} sub={lastActivity?.action} />
              <Stat label="Sequences" value={`WO ${shop.woSeq} · INV ${shop.invSeq}`} />
            </div>
          </Card>
          <Card title="Staff logins" padded={false}>
            <ul className="divide-y divide-border">
              {shop.users.map((u) => (
                <li key={u.id} className="px-5 py-2.5 text-sm flex items-center justify-between gap-2">
                  <span><span className="font-medium">{u.name}</span><span className="text-xs text-muted block">{u.email}</span></span>
                  <span className="flex items-center gap-2"><Badge tone="slate">{ROLE_LABEL[u.role]}</Badge>{!u.active ? <Badge tone="red">disabled</Badge> : null}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="xl:col-span-2 space-y-4">
          <Card title="Plan & status">
            <form action={adminUpdateShop.bind(null, shop.id)} className="grid sm:grid-cols-2 gap-4">
              <Field label="Shop name" className="sm:col-span-2"><input name="name" defaultValue={shop.name} className="input" /></Field>
              <Field label="Plan">
                <select name="plan" defaultValue={shop.plan} className="select">{["TRIAL", "STARTER", "PRO", "ENTERPRISE"].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}</select>
              </Field>
              <Field label="Status">
                <select name="status" defaultValue={shop.status} className="select">{["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"].map((p) => <option key={p} value={p}>{p.replace("_", " ").toLowerCase()}</option>)}</select>
              </Field>
              <Field label="Trial ends"><input name="trialEndsAt" type="date" defaultValue={toDateInput(shop.trialEndsAt)} className="input" /></Field>
              <Field label="Internal notes" className="sm:col-span-2"><textarea name="notes" rows={2} defaultValue={shop.notes ?? ""} className="textarea" placeholder="Billing contact, special terms…" /></Field>
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <button className="btn btn-primary"><Save size={15} /> Save</button>
                <button formAction={adminExtendTrial.bind(null, shop.id, 14)} className="btn btn-secondary">Extend trial 14 days</button>
              </div>
            </form>
            <p className="text-xs text-faint mt-3">Suspended and cancelled shops cannot sign in and their API keys stop working; their data is kept.</p>
          </Card>
          <Card title="Locations & shared access">
            <p className="text-xs text-muted mb-3">Multi-location owners switch shops from the header. Memberships let an existing login work here with a role; the shop the user signed up with stays their home shop.</p>
            {shop.members.length ? (
              <ul className="divide-y divide-border mb-4">
                {shop.members.map((m) => (
                  <li key={m.id} className="py-2 text-sm flex items-center justify-between gap-2">
                    <span><span className="font-medium">{m.user.name}</span><span className="text-xs text-muted block">{m.user.email} · home: {m.user.shop?.name ?? "—"}</span></span>
                    <span className="flex items-center gap-2"><Badge tone="slate">{ROLE_LABEL[m.role]}</Badge><form action={adminRevokeAccess.bind(null, shop.id, m.user.id)}><button className="btn btn-ghost btn-sm text-red-400">Remove</button></form></span>
                  </li>
                ))}
              </ul>
            ) : null}
            <form action={adminGrantAccess.bind(null, shop.id)} className="flex flex-col sm:flex-row gap-2 mb-4">
              <input name="email" type="email" required placeholder="existing staff login email" className="input" />
              <select name="role" className="select sm:w-44" defaultValue="OWNER">{["OWNER", "ADMIN", "SERVICE_ADVISOR", "TECHNICIAN"].map((r) => <option key={r} value={r}>{ROLE_LABEL[r as keyof typeof ROLE_LABEL]}</option>)}</select>
              <button className="btn btn-secondary shrink-0">Grant access</button>
            </form>
            <form action={adminAddLocation.bind(null, shop.id)} className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-border">
              <input name="name" required placeholder="New location name" className="input" />
              <input name="ownerEmail" type="email" required defaultValue={shop.ownerEmail ?? ""} placeholder="owner's login email" className="input" />
              <button className="btn btn-primary shrink-0">Add location</button>
            </form>
            <p className="text-[11px] text-faint mt-2">New locations are created on the Enterprise plan with the same owner login; billing for extra locations is handled by hand.</p>
          </Card>
          <Card title="Owner password reset">
            <form action={adminResetOwnerPassword.bind(null, shop.id)} className="flex gap-2">
              <input name="password" type="password" minLength={8} required placeholder="New temporary password" className="input" autoComplete="new-password" />
              <button className="btn btn-secondary shrink-0"><KeyRound size={14} /> Reset</button>
            </form>
          </Card>
          <Card title="Danger zone">
            <form action={adminDeleteShop.bind(null, shop.id)} className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input name="confirm" placeholder={`Type "${shop.slug}" to confirm`} className="input" />
              <ConfirmButton message={`Permanently delete ${shop.name} and ALL its data?`} className="btn btn-danger shrink-0"><Trash2 size={14} /> Delete shop</ConfirmButton>
            </form>
            <p className="text-xs text-faint mt-2">Deletes every customer, vehicle, work order, invoice, file reference and login belonging to this shop. Settings: {shop.settings ? `${shop.settings.modules.length} modules on` : "none"} · last updated {fmtDateTime(shop.updatedAt)}.</p>
          </Card>
        </div>
      </div>
      <p className="text-xs text-faint mt-4"><Link href="/admin" className="text-accent hover:underline">← All shops</Link></p>
    </div>
  );
}
