import Link from "next/link";
import { notFound } from "next/navigation";
import { Send } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Avatar, Card, Flash, PageHeader } from "@/components/ui";
import { sendStaffMessage } from "@/actions/messages";
import { fmtDateTime, vehicleName, woNumber } from "@/lib/format";

export default async function ThreadPage({ params, searchParams }: { params: Promise<{ customerId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireStaff();
  const { customerId } = await params;
  const sp = await searchParams;
  const c = await db.customer.findUnique({ where: { id: customerId }, include: { messages: { orderBy: { createdAt: "asc" }, include: { workOrder: { select: { id: true, number: true } } } }, workOrders: { where: { status: { notIn: ["INVOICED", "CANCELLED"] } }, include: { vehicle: true }, orderBy: { createdAt: "desc" } }, portalUser: { select: { id: true } } } });
  if (!c) notFound();
  if (c.messages.some((m) => m.direction === "INBOUND" && !m.readAt)) {
    await db.message.updateMany({ where: { customerId, direction: "INBOUND", readAt: null }, data: { readAt: new Date() } });
  }

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3"><Avatar name={`${c.firstName} ${c.lastName}`} size={32} /> {c.firstName} {c.lastName}</span>}
        subtitle={<>{[c.phone, c.email].filter(Boolean).join(" · ")}{!c.portalUser ? " · no portal login (replies only by phone/email)" : ""} · <Link href={`/customers/${c.id}`} className="text-accent hover:underline">Profile</Link></>}
        crumbs={[{ label: "Messages", href: "/messages" }, { label: `${c.firstName} ${c.lastName}` }]}
      />
      <Flash searchParams={sp} />
      <Card padded={false} className="max-w-3xl">
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {c.messages.map((m) => (
            <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.direction === "OUTBOUND" ? "bg-accent text-white rounded-br-sm" : "bg-bg-elevated border border-border rounded-bl-sm"}`}>
                <div className="whitespace-pre-line">{m.body}</div>
                <div className={`text-[10px] mt-1 ${m.direction === "OUTBOUND" ? "text-white/70" : "text-faint"}`}>{m.authorName} · {fmtDateTime(m.createdAt)}{m.workOrder ? ` · ${woNumber(m.workOrder.number)}` : ""}</div>
              </div>
            </div>
          ))}
          {!c.messages.length ? <p className="text-sm text-muted text-center py-6">No messages yet.</p> : null}
        </div>
        <form action={sendStaffMessage.bind(null, c.id)} className="border-t border-border p-3 flex flex-col sm:flex-row gap-2">
          <select name="workOrderId" className="select sm:w-56" defaultValue="">
            <option value="">No work order</option>
            {c.workOrders.map((w) => <option key={w.id} value={w.id}>{woNumber(w.number)} · {vehicleName(w.vehicle)}</option>)}
          </select>
          <input name="body" required placeholder="Type a message… (sent to portal, email and SMS)" className="input flex-1" autoFocus />
          <button className="btn btn-primary"><Send size={15} /> Send</button>
        </form>
      </Card>
    </div>
  );
}
