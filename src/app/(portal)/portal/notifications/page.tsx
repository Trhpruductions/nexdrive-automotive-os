import { Bell } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Updates" };

export default async function PortalNotificationsPage() {
  const user = await requireCustomer();
  const rows = await db.notification.findMany({ where: { customerId: user.customerId, channel: "PORTAL" }, orderBy: { createdAt: "desc" }, take: 50 });
  await db.notification.updateMany({ where: { customerId: user.customerId, channel: "PORTAL", readAt: null }, data: { readAt: new Date() } });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Updates</h1>
      <Card padded={false}>
        <ul className="divide-y divide-border">
          {rows.map((n) => (
            <li key={n.id} className={`px-5 py-3 flex gap-3 ${!n.readAt ? "bg-accent-soft/40" : ""}`}>
              <span className="h-8 w-8 rounded-lg bg-card-hover grid place-items-center text-muted shrink-0"><Bell size={14} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{n.subject}</div>
                <div className="text-sm text-muted">{n.body}</div>
                <div className="text-[11px] text-faint mt-1">{fmtDateTime(n.createdAt)}</div>
              </div>
            </li>
          ))}
          {!rows.length ? <li className="px-5 py-8 text-sm text-muted text-center">No updates yet.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
