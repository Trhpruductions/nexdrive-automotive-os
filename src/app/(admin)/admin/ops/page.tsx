import { subDays, subHours } from "date-fns";
import { Activity, AlertTriangle, CheckCircle2, Mail, Plug, Webhook } from "lucide-react";
import { requireSuperadmin } from "@/lib/auth";
import { rawDb } from "@/lib/db";
import { Badge, Card, KpiCard, PageHeader } from "@/components/ui";
import { mailConfigured, smsConfigured } from "@/lib/mail";
import { platformBillingConfigured } from "@/lib/billing";
import { fmtDateTime, fmtRelative } from "@/lib/format";

export const metadata = { title: "Ops" };

/** Platform health: scheduler runs, outbox, integrations, webhooks, config. */
export default async function AdminOpsPage() {
  await requireSuperadmin();
  const now = new Date();
  const [runs, failed24h, queued, failedNotif, integrationsErr, webhookFails, activeShops, signups7d, revenue30] = await Promise.all([
    rawDb.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 60 }),
    rawDb.jobRun.count({ where: { ok: false, startedAt: { gte: subHours(now, 24) } } }),
    rawDb.notification.count({ where: { status: "QUEUED", channel: { in: ["EMAIL", "SMS"] } } }),
    rawDb.notification.count({ where: { status: "FAILED", createdAt: { gte: subDays(now, 7) } } }),
    rawDb.integration.findMany({ where: { lastError: { not: null } }, select: { id: true, name: true, lastError: true, lastSeenAt: true, shop: { select: { name: true } } }, orderBy: { lastSeenAt: "desc" }, take: 10 }),
    rawDb.webhookDelivery.count({ where: { ok: false, createdAt: { gte: subDays(now, 7) } } }),
    rawDb.shop.count({ where: { status: { in: ["ACTIVE", "TRIAL"] } } }),
    rawDb.shop.count({ where: { createdAt: { gte: subDays(now, 7) } } }),
    rawDb.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: subDays(now, 30) } } }),
  ]);
  // latest run per job name
  const latest = new Map<string, (typeof runs)[number]>();
  for (const r of runs) if (!latest.has(r.name)) latest.set(r.name, r);
  const lastRun = runs[0]?.startedAt ?? null;
  const stale = !lastRun || lastRun < subHours(now, 2);
  const config = [
    { label: "Email provider", ok: mailConfigured(), hint: "RESEND_API_KEY or SMTP_HOST" },
    { label: "SMS provider", ok: smsConfigured(), hint: "TWILIO_*" },
    { label: "Self-service billing", ok: platformBillingConfigured(), hint: "STRIPE_PLATFORM_* + prices" },
    { label: "Ops alerts", ok: Boolean(process.env.OPS_WEBHOOK_URL), hint: "OPS_WEBHOOK_URL" },
    { label: "Public URL", ok: Boolean(process.env.APP_URL), hint: "APP_URL" },
    { label: "NexDrive AI", ok: Boolean(process.env.ANTHROPIC_API_KEY), hint: "ANTHROPIC_API_KEY" },
  ];

  return (
    <div>
      <PageHeader title="Ops" subtitle="Scheduler, outbox, feeds and configuration across the platform." />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Scheduler" value={stale ? "stale" : "running"} hint={lastRun ? `last run ${fmtRelative(lastRun)}` : "never run"} icon={Activity} tone={stale ? "red" : "green"} />
        <KpiCard label="Job failures (24h)" value={failed24h} icon={AlertTriangle} tone={failed24h ? "red" : "green"} />
        <KpiCard label="Outbox queued" value={queued} hint={`${failedNotif} failed this week`} icon={Mail} tone={queued > 50 ? "amber" : "slate"} />
        <KpiCard label="Webhook failures (7d)" value={webhookFails} icon={Webhook} tone={webhookFails ? "amber" : "slate"} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title="Scheduled jobs" padded={false}>
          <table className="table">
            <thead><tr><th>Job</th><th>Last run</th><th className="text-right">Result</th><th>Detail</th></tr></thead>
            <tbody>
              {[...latest.values()].map((r) => (
                <tr key={r.name}>
                  <td className="font-medium">{r.name}</td>
                  <td className="text-xs text-muted whitespace-nowrap">{fmtDateTime(r.startedAt)}{r.finishedAt ? ` · ${Math.max(0, r.finishedAt.getTime() - r.startedAt.getTime())} ms` : " · running"}</td>
                  <td className="text-right">{r.ok ? <Badge tone="green"><CheckCircle2 size={12} /> {r.count}</Badge> : <Badge tone="red">failed</Badge>}</td>
                  <td className="text-xs text-muted max-w-[320px] truncate">{r.detail?.split("\n")[0]}</td>
                </tr>
              ))}
              {!latest.size ? <tr><td colSpan={4} className="text-center text-muted py-8">No runs logged yet — the scheduler runs 30 s after boot, then hourly.</td></tr> : null}
            </tbody>
          </table>
          {runs.some((r) => !r.ok) ? (
            <div className="px-5 py-3 border-t border-border">
              <div className="card-title mb-2">Recent failures</div>
              <ul className="text-xs text-muted space-y-1">{runs.filter((r) => !r.ok).slice(0, 8).map((r) => <li key={r.id}><span className="text-text">{r.name}</span> · {fmtDateTime(r.startedAt)} · {r.detail?.split("\n")[0]}</li>)}</ul>
            </div>
          ) : null}
        </Card>
        <div className="space-y-4">
          <Card title="Configuration">
            <ul className="text-sm divide-y divide-border">
              {config.map((c) => <li key={c.label} className="py-2 flex items-center justify-between gap-2"><span>{c.label}<span className="block text-[11px] text-faint font-mono">{c.hint}</span></span><Badge tone={c.ok ? "green" : "slate"}>{c.ok ? "set" : "not set"}</Badge></li>)}
            </ul>
          </Card>
          <Card title="Platform">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-2xl font-semibold">{activeShops}</div><div className="text-[11px] text-muted">active shops</div></div>
              <div><div className="text-2xl font-semibold">{signups7d}</div><div className="text-[11px] text-muted">sign-ups (7d)</div></div>
              <div><div className="text-2xl font-semibold">${Math.round(Number(revenue30._sum.amount ?? 0)).toLocaleString()}</div><div className="text-[11px] text-muted">processed (30d)</div></div>
            </div>
          </Card>
          <Card title="Feeds with errors" padded={false}>
            <ul className="divide-y divide-border">
              {integrationsErr.map((i) => <li key={i.id} className="px-5 py-2.5 text-sm"><div className="flex items-center gap-2"><Plug size={13} className="text-amber-400" /><span className="font-medium">{i.name}</span><span className="text-xs text-muted">· {i.shop.name}</span></div><div className="text-xs text-muted truncate">{i.lastError}{i.lastSeenAt ? ` · last seen ${fmtRelative(i.lastSeenAt)}` : ""}</div></li>)}
              {!integrationsErr.length ? <li className="px-5 py-6 text-center text-sm text-muted">All feeds healthy.</li> : null}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
