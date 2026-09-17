import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card } from "@/components/ui";
import { WO_STATUS } from "@/lib/constants";
import { fmtDate, invNumber, money, num, vehicleName } from "@/lib/format";

export const metadata = { title: "My vehicle" };

export default async function PortalVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCustomer();
  const { id } = await params;
  const v = await db.vehicle.findUnique({
    where: { id },
    include: {
      workOrders: { where: { status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" }, include: { invoice: true } },
      reminders: { where: { completed: false }, orderBy: { dueAtDate: "asc" } },
      photos: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  if (!v || v.customerId !== user.customerId) notFound();

  return (
    <div className="space-y-5">
      <Link href="/portal" className="text-sm text-muted hover:text-text inline-flex items-center gap-1"><ArrowLeft size={14} /> Back</Link>
      <div>
        <h1 className="text-2xl font-semibold">{vehicleName(v)}</h1>
        <p className="text-sm text-muted mt-1">{[v.color, v.licensePlate, v.vin ? `VIN ${v.vin}` : null, `${num(v.mileage)} mi`].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Maintenance reminders">
          {v.reminders.length ? (
            <ul className="space-y-2 text-sm">
              {v.reminders.map((r) => {
                const overdue = (r.dueAtDate && r.dueAtDate < new Date()) || (r.dueAtMileage && r.dueAtMileage <= v.mileage);
                return (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span>{r.service}</span>
                    <span className={`text-xs ${overdue ? "text-amber-400 font-semibold" : "text-muted"}`}>{overdue ? "Due now" : [r.dueAtMileage ? `${num(r.dueAtMileage)} mi` : null, r.dueAtDate ? fmtDate(r.dueAtDate) : null].filter(Boolean).join(" / ")}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">No reminders set.</p>
          )}
          <Link href={`/portal/book?vehicleId=${v.id}`} className="btn btn-primary btn-sm mt-4 w-full">Book service</Link>
        </Card>
        <Card className="lg:col-span-2" title="Service history" padded={false}>
          {v.workOrders.length ? (
            <table className="table">
              <thead><tr><th>Date</th><th>Service</th><th>Status</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {v.workOrders.map((w) => (
                  <tr key={w.id} className="row-link">
                    <td className="text-xs text-muted">{fmtDate(w.createdAt)}</td>
                    <td><Link href={`/portal/service/${w.id}`} className="hover:text-accent">{w.complaint}</Link>{w.invoice ? <div className="text-xs text-faint">{invNumber(w.invoice.number)}</div> : null}</td>
                    <td><Badge tone={WO_STATUS[w.status].tone}>{WO_STATUS[w.status].label}</Badge></td>
                    <td className="text-right tabular-nums">{w.invoice ? money(w.invoice.total) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-5 text-sm text-muted">No visits yet.</p>
          )}
        </Card>
      </div>
      {v.photos.length ? (
        <Card title="Photos">
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {v.photos.map((p) => (
              <li key={p.id}>
                <a href={p.url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? ""} className="aspect-[4/3] w-full object-cover" />
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
