import { Send } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, Flash } from "@/components/ui";
import { sendPortalMessage } from "@/actions/messages";
import { fmtDateTime, vehicleName, woNumber } from "@/lib/format";

export const metadata = { title: "Messages" };

export default async function PortalMessagesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireCustomer();
  const sp = await searchParams;
  const [messages, active] = await Promise.all([
    db.message.findMany({ where: { customerId: user.customerId }, orderBy: { createdAt: "asc" }, include: { workOrder: { select: { number: true } } } }),
    db.workOrder.findMany({ where: { customerId: user.customerId, status: { notIn: ["INVOICED", "CANCELLED"] } }, include: { vehicle: true } }),
  ]);
  await db.message.updateMany({ where: { customerId: user.customerId, direction: "OUTBOUND", readAt: null }, data: { readAt: new Date() } });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Messages</h1>
      <Flash searchParams={sp} />
      <Card padded={false}>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.direction === "INBOUND" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.direction === "INBOUND" ? "bg-accent text-white rounded-br-sm" : "bg-bg-elevated border border-border rounded-bl-sm"}`}>
                <div className="whitespace-pre-line">{m.body}</div>
                <div className={`text-[10px] mt-1 ${m.direction === "INBOUND" ? "text-white/70" : "text-faint"}`}>
                  {m.direction === "INBOUND" ? "You" : m.authorName ?? "Shop"} · {fmtDateTime(m.createdAt)}{m.workOrder ? ` · ${woNumber(m.workOrder.number)}` : ""}
                </div>
              </div>
            </div>
          ))}
          {!messages.length ? <p className="text-sm text-muted text-center py-6">No messages yet. Ask us anything about your vehicle.</p> : null}
        </div>
        <form action={sendPortalMessage} className="border-t border-border p-3 flex flex-col sm:flex-row gap-2">
          {active.length ? (
            <select name="workOrderId" className="select sm:w-56" defaultValue={active[0].id}>
              {active.map((w) => <option key={w.id} value={w.id}>{woNumber(w.number)} · {vehicleName(w.vehicle)}</option>)}
              <option value="">General question</option>
            </select>
          ) : null}
          <input name="body" required placeholder="Type a message to the shop…" className="input flex-1" />
          <button className="btn btn-primary"><Send size={15} /> Send</button>
        </form>
      </Card>
    </div>
  );
}
