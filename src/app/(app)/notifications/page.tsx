import Link from "next/link";
import { Bell, RotateCw, Send } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { Pagination } from "@/components/app/search-bar";
import { retryNotification, sendNotification } from "@/actions/messages";
import { fmtDateTime, woNumber } from "@/lib/format";

export const metadata = { title: "Notifications" };
const PAGE = 40;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; ok?: string; error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.status === "queued" ? { status: "QUEUED" as const } : sp.status === "failed" ? { status: "FAILED" as const } : {};
  const [total, rows, customers, queued] = await Promise.all([
    db.notification.count({ where }),
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { customer: true, workOrder: { select: { id: true, number: true } } } }),
    db.customer.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
    db.notification.count({ where: { status: "QUEUED" } }),
  ]);
  const providers = { email: Boolean(process.env.RESEND_API_KEY), sms: Boolean(process.env.TWILIO_ACCOUNT_SID) };

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Everything sent to customers — estimate links, ready-for-pickup, appointment confirmations, invoices." />
      <Flash searchParams={sp} />
      {!providers.email || !providers.sms ? (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
          Portal notifications are live. {!providers.email ? "Email" : ""}{!providers.email && !providers.sms ? " and " : ""}{!providers.sms ? "SMS" : ""} stay <strong>queued</strong> until you add {!providers.email ? "RESEND_API_KEY" : ""}{!providers.email && !providers.sms ? " / " : ""}{!providers.sms ? "TWILIO_*" : ""} to <code>.env</code> — see Settings → Integrations.
        </div>
      ) : null}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="Send a notification">
          <form action={sendNotification} className="space-y-3">
            <select name="customerId" required className="select" defaultValue="">
              <option value="" disabled>Customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.lastName}, {c.firstName}</option>)}
            </select>
            <input name="subject" required placeholder="Subject" className="input" />
            <textarea name="body" required rows={4} placeholder="Message" className="textarea" />
            <div className="flex gap-4 text-sm">
              {["PORTAL", "EMAIL", "SMS"].map((ch) => <label key={ch} className="flex items-center gap-1.5"><input type="checkbox" name="channels" value={ch} defaultChecked className="accent-[var(--accent)]" /> {ch[0] + ch.slice(1).toLowerCase()}</label>)}
            </div>
            <button className="btn btn-primary w-full"><Send size={15} /> Send</button>
          </form>
        </Card>
        <Card className="xl:col-span-2" title="Outbox" action={
          <div className="flex gap-1.5">
            {[{ k: "", l: "All" }, { k: "queued", l: `Queued (${queued})` }, { k: "failed", l: "Failed" }].map((t) => <Link key={t.k} href={`/notifications${t.k ? `?status=${t.k}` : ""}`} className={`rounded-full px-2.5 py-0.5 text-xs border ${(sp.status ?? "") === t.k ? "bg-accent border-accent text-white" : "border-border text-muted"}`}>{t.l}</Link>)}
          </div>
        } padded={false}>
          {rows.length ? (
            <ul className="divide-y divide-border">
              {rows.map((n) => (
                <li key={n.id} className="px-5 py-3 flex items-start gap-3">
                  <span className="h-8 w-8 rounded-lg bg-card-hover grid place-items-center text-muted shrink-0"><Bell size={14} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm"><Link href={`/customers/${n.customerId}`} className="font-medium hover:text-accent">{n.customer.firstName} {n.customer.lastName}</Link><Badge tone="slate">{n.channel}</Badge><Badge tone={n.status === "SENT" ? "green" : n.status === "FAILED" ? "red" : "amber"}>{n.status.toLowerCase()}</Badge>{n.workOrder ? <Link href={`/work-orders/${n.workOrder.id}`} className="text-xs text-accent">{woNumber(n.workOrder.number)}</Link> : null}</div>
                    <div className="text-sm mt-0.5">{n.subject}</div>
                    <div className="text-xs text-muted truncate">{n.body}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-faint">{fmtDateTime(n.sentAt ?? n.createdAt)}</div>
                    {n.status !== "SENT" ? <form action={retryNotification.bind(null, n.id)}><button className="btn btn-ghost btn-sm mt-1"><RotateCw size={12} /> Retry</button></form> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Bell} title="Nothing here yet" />
          )}
        </Card>
      </div>
      <Pagination page={page} pages={Math.ceil(total / PAGE)} base={`/notifications${sp.status ? `?status=${sp.status}` : ""}`} />
    </div>
  );
}
