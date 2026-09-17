import Link from "next/link";
import { notFound } from "next/navigation";
import { Car, KeyRound, Mail, MapPin, MessageSquare, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { requireStaff, can, MANAGER_ROLES, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Flash, PageHeader, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { deleteCustomer, revokePortalAccess, setPortalAccess } from "@/actions/customers";
import { INVOICE_STATUS, WO_STATUS } from "@/lib/constants";
import { computeTotals } from "@/lib/money";
import { fmtDate, fmtDateTime, invNumber, money, num, vehicleName, woNumber } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.customer.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
  return { title: c ? `${c.firstName} ${c.lastName}` : "Customer" };
}

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireStaff();
  const settings = await getSettings();
  const { id } = await params;
  const sp = await searchParams;
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      vehicles: { orderBy: { createdAt: "desc" }, include: { _count: { select: { workOrders: true } } } },
      workOrders: { orderBy: { createdAt: "desc" }, take: 15, include: { vehicle: true, lines: true, invoice: true } },
      invoices: { orderBy: { issuedAt: "desc" }, take: 10 },
      appointments: { where: { scheduledStart: { gte: new Date() } }, orderBy: { scheduledStart: "asc" }, take: 5, include: { vehicle: true } },
      portalUser: true,
      _count: { select: { messages: { where: { direction: "INBOUND", readAt: null } } } },
    },
  });
  if (!c) notFound();

  const lifetime = c.invoices.filter((i) => i.status !== "VOID").reduce((s, i) => s + Number(i.amountPaid), 0);
  const outstanding = c.invoices.filter((i) => i.status === "SENT" || i.status === "PARTIAL").reduce((s, i) => s + Number(i.total) - Number(i.amountPaid), 0);

  return (
    <div>
      <PageHeader
        title={`${c.firstName} ${c.lastName}`}
        subtitle={c.company ?? undefined}
        crumbs={[{ label: "Customers", href: "/customers" }, { label: `${c.firstName} ${c.lastName}` }]}
        actions={
          <>
            <Link href={`/messages/${c.id}`} className="btn btn-secondary"><MessageSquare size={16} /> Message{c._count.messages ? ` (${c._count.messages})` : ""}</Link>
            <Link href={`/work-orders/new?customerId=${c.id}`} className="btn btn-secondary"><Plus size={16} /> Work order</Link>
            <Link href={`/customers/${c.id}/edit`} className="btn btn-primary"><Pencil size={16} /> Edit</Link>
          </>
        }
      />
      <Flash searchParams={sp} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card title="Contact">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><Phone size={14} className="text-muted" /> {c.phone ? <a href={`tel:${c.phone}`} className="hover:text-accent">{c.phone}</a> : <span className="text-faint">No phone</span>}</div>
              <div className="flex items-center gap-2"><Mail size={14} className="text-muted" /> {c.email ? <a href={`mailto:${c.email}`} className="hover:text-accent">{c.email}</a> : <span className="text-faint">No email</span>}</div>
              <div className="flex items-start gap-2"><MapPin size={14} className="text-muted mt-0.5" /> {c.address || c.city ? <span>{c.address}<br />{[c.city, c.state].filter(Boolean).join(", ")} {c.zip}</span> : <span className="text-faint">No address</span>}</div>
              {c.taxExempt ? <Badge tone="violet">Tax exempt</Badge> : null}
              {c.notes ? <p className="text-muted whitespace-pre-line border-t border-border pt-3">{c.notes}</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-border">
              <Stat label="Lifetime value" value={money(lifetime)} />
              <Stat label="Outstanding" value={<span className={outstanding > 0 ? "text-amber-400" : ""}>{money(outstanding)}</span>} />
              <Stat label="Customer since" value={fmtDate(c.createdAt)} />
              <Stat label="Vehicles" value={c.vehicles.length} />
            </div>
          </Card>

          <Card title="Customer portal">
            {c.portalUser ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted">Login</span><span>{c.portalUser.email}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Status</span><Badge tone="green">Active</Badge></div>
                {can(user, BILLING_ROLES) ? (
                  <>
                    <form action={setPortalAccess.bind(null, c.id)} className="flex gap-2 pt-2 border-t border-border">
                      <input name="password" type="password" minLength={8} placeholder="New password" className="input" required />
                      <button className="btn btn-secondary btn-sm shrink-0"><KeyRound size={14} /> Reset</button>
                    </form>
                    <form action={revokePortalAccess.bind(null, c.id)}>
                      <ConfirmButton message="Remove this customer's portal login?" className="btn btn-ghost btn-sm text-red-400">Remove access</ConfirmButton>
                    </form>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="text-sm space-y-3">
                <p className="text-muted">Give this customer a login to approve estimates, view history and message the shop.</p>
                {can(user, BILLING_ROLES) ? (
                  <form action={setPortalAccess.bind(null, c.id)} className="flex gap-2">
                    <input name="password" type="password" minLength={8} placeholder="Set a password (8+ chars)" className="input" required />
                    <button className="btn btn-primary btn-sm shrink-0"><KeyRound size={14} /> Enable</button>
                  </form>
                ) : null}
                {!c.email ? <p className="text-xs text-amber-400">Add an email address first.</p> : null}
              </div>
            )}
          </Card>

          {can(user, MANAGER_ROLES) ? (
            <form action={deleteCustomer.bind(null, c.id)} className="text-right">
              <ConfirmButton message="Delete this customer and their vehicles? This cannot be undone."><Trash2 size={14} /> Delete customer</ConfirmButton>
            </form>
          ) : null}
        </div>

        <div className="xl:col-span-2 space-y-4">
          <Card title="Vehicles" action={<Link href={`/vehicles/new?customerId=${c.id}`} className="btn btn-secondary btn-sm"><Plus size={14} /> Add vehicle</Link>}>
            {c.vehicles.length ? (
              <ul className="grid sm:grid-cols-2 gap-3">
                {c.vehicles.map((v) => (
                  <li key={v.id}>
                    <Link href={`/vehicles/${v.id}`} className="card card-hover p-4 flex items-center gap-3 transition-colors">
                      <span className="h-10 w-10 rounded-lg bg-accent-soft text-accent grid place-items-center"><Car size={18} /></span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{vehicleName(v)}</div>
                        <div className="text-xs text-muted">{v.licensePlate ?? "No plate"} · {num(v.mileage)} mi · {v._count.workOrders} visit{v._count.workOrders === 1 ? "" : "s"}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No vehicles on file.</p>
            )}
          </Card>

          {c.appointments.length ? (
            <Card title="Upcoming appointments">
              <ul className="divide-y divide-border -my-2">
                {c.appointments.map((a) => (
                  <li key={a.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <Link href={`/schedule/${a.id}`} className="hover:text-accent">{a.serviceRequested}</Link>
                    <span className="text-muted text-xs">{vehicleName(a.vehicle)} · {fmtDateTime(a.scheduledStart)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Work order history" padded={false}>
            {c.workOrders.length ? (
              <table className="table">
                <thead><tr><th>Work order</th><th>Vehicle</th><th>Status</th><th>Date</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {c.workOrders.map((w) => {
                    const t = computeTotals(w.lines, settings.taxRate, { taxExempt: c.taxExempt });
                    return (
                      <tr key={w.id} className="row-link">
                        <td><Link href={`/work-orders/${w.id}`} className="font-medium hover:text-accent">{woNumber(w.number)}</Link><div className="text-xs text-muted truncate max-w-[220px]">{w.complaint}</div></td>
                        <td className="text-muted text-xs">{vehicleName(w.vehicle)}</td>
                        <td><Badge tone={WO_STATUS[w.status].tone}>{WO_STATUS[w.status].label}</Badge></td>
                        <td className="text-muted text-xs">{fmtDate(w.createdAt)}</td>
                        <td className="text-right tabular-nums">{money(t.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted p-5">No work orders yet.</p>
            )}
          </Card>

          {c.invoices.length ? (
            <Card title="Invoices" padded={false}>
              <table className="table">
                <thead><tr><th>Invoice</th><th>Status</th><th>Issued</th><th className="text-right">Total</th><th className="text-right">Balance</th></tr></thead>
                <tbody>
                  {c.invoices.map((i) => (
                    <tr key={i.id} className="row-link">
                      <td><Link href={`/invoices/${i.id}`} className="font-medium hover:text-accent">{invNumber(i.number)}</Link></td>
                      <td><Badge tone={INVOICE_STATUS[i.status].tone}>{INVOICE_STATUS[i.status].label}</Badge></td>
                      <td className="text-muted text-xs">{fmtDate(i.issuedAt)}</td>
                      <td className="text-right tabular-nums">{money(i.total)}</td>
                      <td className="text-right tabular-nums">{money(Number(i.total) - Number(i.amountPaid))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
