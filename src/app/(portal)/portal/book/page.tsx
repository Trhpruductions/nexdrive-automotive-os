import { CalendarPlus } from "lucide-react";
import { addDays } from "date-fns";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Card, Field, Flash } from "@/components/ui";
import { requestAppointment } from "@/actions/portal";
import { vehicleName } from "@/lib/format";

export const metadata = { title: "Book service" };

export default async function PortalBookPage({ searchParams }: { searchParams: Promise<{ vehicleId?: string; ok?: string; error?: string }> }) {
  const user = await requireCustomer();
  const s = await getSettings();
  const sp = await searchParams;
  const vehicles = await db.vehicle.findMany({ where: { customerId: user.customerId }, orderBy: { createdAt: "asc" } });
  const tomorrow = addDays(new Date(), 1).toISOString().slice(0, 10);

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Book service</h1>
        <p className="text-sm text-muted mt-1">Pick a time and we&apos;ll confirm it. Open {s.openTime}–{s.closeTime}.</p>
      </div>
      <Flash searchParams={sp} />
      <Card>
        <form action={requestAppointment} className="space-y-4">
          <Field label="Vehicle">
            <select name="vehicleId" required defaultValue={sp.vehicleId ?? vehicles[0]?.id ?? ""} className="select">
              {vehicles.map((v) => <option key={v.id} value={v.id}>{vehicleName(v)}{v.licensePlate ? ` · ${v.licensePlate}` : ""}</option>)}
            </select>
          </Field>
          <Field label="What do you need?"><input name="serviceRequested" required className="input" placeholder="Oil change, brakes squealing, check engine light…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preferred date"><input name="date" type="date" required min={tomorrow} defaultValue={tomorrow} className="input" /></Field>
            <Field label="Preferred time"><input name="time" type="time" required defaultValue={s.openTime} min={s.openTime} max={s.closeTime} className="input" /></Field>
          </div>
          <Field label="Notes"><textarea name="notes" rows={3} className="textarea" placeholder="Anything we should know" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="dropOff" value="true" defaultChecked className="accent-[var(--accent)]" /> I&apos;ll drop the vehicle off</label>
          <button className="btn btn-primary w-full py-3"><CalendarPlus size={16} /> Request appointment</button>
        </form>
      </Card>
    </div>
  );
}
