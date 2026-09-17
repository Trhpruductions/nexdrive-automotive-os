import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Avatar, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { fmtRelative } from "@/lib/format";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  await requireStaff();
  // latest message per customer
  const latest = await db.message.findMany({ orderBy: { createdAt: "desc" }, distinct: ["customerId"], include: { customer: true } });
  const unread = await db.message.groupBy({ by: ["customerId"], where: { direction: "INBOUND", readAt: null }, _count: { _all: true } });
  const unreadOf = (id: string) => unread.find((u) => u.customerId === id)?._count._all ?? 0;
  const customers = await db.customer.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } });

  return (
    <div>
      <PageHeader title="Messages" subtitle="Two-way messaging with customers. Replies from the portal land here; outbound messages also go by email/SMS." actions={
        <form action="/messages" method="get" className="flex gap-2">
          <select name="to" className="select w-56" defaultValue="">
            <option value="" disabled>Start a conversation…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.lastName}, {c.firstName}</option>)}
          </select>
          <StartButton />
        </form>
      } />
      <Card padded={false}>
        {latest.length ? (
          <ul className="divide-y divide-border">
            {latest.map((m) => {
              const n = unreadOf(m.customerId);
              return (
                <li key={m.id}>
                  <Link href={`/messages/${m.customerId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-card-hover">
                    <Avatar name={`${m.customer.firstName} ${m.customer.lastName}`} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><span className={`text-sm ${n ? "font-semibold" : "font-medium"}`}>{m.customer.firstName} {m.customer.lastName}</span>{n ? <Badge tone="blue">{n} new</Badge> : null}</div>
                      <div className={`text-xs truncate ${n ? "text-text" : "text-muted"}`}>{m.direction === "OUTBOUND" ? "You: " : ""}{m.body}</div>
                    </div>
                    <span className="text-xs text-faint shrink-0">{fmtRelative(m.createdAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={MessageSquare} title="No conversations yet" hint="Pick a customer above to send the first message." />
        )}
      </Card>
    </div>
  );
}

function StartButton() {
  return <button className="btn btn-primary" formAction="/messages/start">Open</button>;
}
