import { Check, Inbox, Undo2 } from "lucide-react";
import { requireSuperadmin } from "@/lib/auth";
import { rawDb } from "@/lib/db";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { markLeadHandled } from "@/actions/platform";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Leads" };

export default async function AdminLeadsPage() {
  await requireSuperadmin();
  const leads = await rawDb.lead.findMany({ orderBy: [{ handled: "asc" }, { createdAt: "desc" }], take: 200 });
  return (
    <div>
      <PageHeader title="Leads" subtitle="Demo and contact requests from the public website" />
      <Card padded={false}>
        {leads.length ? (
          <ul className="divide-y divide-border">
            {leads.map((l) => (
              <li key={l.id} className={`px-5 py-3 flex items-start gap-3 ${l.handled ? "opacity-60" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{l.name}</span><a href={`mailto:${l.email}`} className="text-accent hover:underline">{l.email}</a>{l.phone ? <span className="text-muted">{l.phone}</span> : null}{l.shopName ? <Badge tone="slate">{l.shopName}</Badge> : null}<Badge tone="violet">{l.source}</Badge></div>
                  {l.message ? <p className="text-sm text-muted mt-1 whitespace-pre-line">{l.message}</p> : null}
                  <div className="text-[11px] text-faint mt-1">{fmtDateTime(l.createdAt)}</div>
                </div>
                <form action={markLeadHandled.bind(null, l.id)}><button className="btn btn-ghost btn-sm">{l.handled ? <><Undo2 size={12} /> Reopen</> : <><Check size={12} /> Handled</>}</button></form>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Inbox} title="No leads yet" hint="Requests from the website's contact form appear here." />
        )}
      </Card>
    </div>
  );
}
