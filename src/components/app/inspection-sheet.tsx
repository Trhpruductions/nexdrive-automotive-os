import Image from "next/image";
import type { ShopSettings } from "@/lib/settings";
import { shopAddress } from "@/lib/settings";
import { INSPECTION_RESULT } from "@/lib/constants";
import { fmtDateTime, num, vehicleName, woNumber } from "@/lib/format";
import { CarDiagram } from "@/app/(app)/inspections/[id]/car-diagram";

type Item = { id: string; category: string; name: string; result: "GOOD" | "ATTENTION" | "URGENT" | "NA"; notes: string | null };

/** Printable multi-point inspection report — used by staff print view and the customer portal. */
export function InspectionSheet({
  settings,
  inspection,
  vehicle,
  customer,
  workOrderNumber,
  technician,
  photos,
}: {
  settings: ShopSettings;
  inspection: { createdAt: Date; updatedAt: Date; summary: string | null; items: Item[] };
  vehicle: { year: number; make: string; model: string; trim?: string | null; licensePlate?: string | null; vin?: string | null; mileage: number };
  customer: { firstName: string; lastName: string };
  workOrderNumber: number;
  technician?: string | null;
  photos: { id: string; url: string; caption: string | null }[];
}) {
  const categories = [...new Set(inspection.items.map((i) => i.category))];
  const counts = { GOOD: 0, ATTENTION: 0, URGENT: 0, NA: 0 };
  for (const it of inspection.items) counts[it.result]++;
  const findings = inspection.items.filter((i) => i.result === "URGENT" || i.result === "ATTENTION");

  return (
    <div className="print-sheet card p-6 sm:p-8 text-sm">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
          ) : (
            <Image src="/brand/mark.png" alt="" width={56} height={56} />
          )}
          <div>
            <div className="text-lg font-semibold leading-tight">{settings.name}</div>
            <div className="text-muted text-xs">{shopAddress(settings).join(" · ")}</div>
            <div className="text-muted text-xs">{[settings.phone, settings.email].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div className="sm:text-right">
          <div className="text-[11px] tracking-[0.2em] text-accent font-bold">{settings.terms.asset.toUpperCase()} INSPECTION REPORT</div>
          <div className="text-xl font-semibold">{woNumber(workOrderNumber)}</div>
          <div className="text-xs text-muted">{fmtDateTime(inspection.updatedAt)}{technician ? ` · ${technician}` : ""}</div>
        </div>
      </div>

      <div className={`grid gap-6 mt-8 ${settings.terms.diagram === "car" ? "sm:grid-cols-[1fr_200px]" : ""}`}>
        <div>
          <div className="grid grid-cols-2 gap-4">
            <div><div className="card-title mb-1">{settings.terms.asset}</div><div className="font-medium">{vehicleName(vehicle)}</div><div className="text-muted">{[vehicle.licensePlate, vehicle.vin ? `${settings.terms.serial} ${vehicle.vin}` : null, settings.terms.odometer ? `${num(vehicle.mileage)} ${settings.terms.odometerUnit}` : null].filter(Boolean).join(" · ")}</div></div>
            <div><div className="card-title mb-1">Customer</div><div className="font-medium">{customer.firstName} {customer.lastName}</div></div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-5">
            {(["GOOD", "ATTENTION", "URGENT", "NA"] as const).map((k) => (
              <div key={k} className="rounded-lg border border-border px-3 py-2 text-center"><div className="text-lg font-semibold tabular-nums">{counts[k]}</div><div className="text-[10px] uppercase tracking-wider text-muted flex items-center justify-center gap-1"><span className={`h-2 w-2 rounded-full ${INSPECTION_RESULT[k].dot}`} />{INSPECTION_RESULT[k].label}</div></div>
            ))}
          </div>
          {findings.length ? (
            <div className="mt-5">
              <div className="card-title mb-2">Needs attention</div>
              <ul className="space-y-1">
                {findings.map((i) => <li key={i.id} className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${INSPECTION_RESULT[i.result].dot}`} /><span><span className="font-medium">{i.name}</span> — {INSPECTION_RESULT[i.result].label}{i.notes ? <span className="text-muted">: {i.notes}</span> : null}</span></li>)}
              </ul>
            </div>
          ) : (
            <p className="mt-5 text-emerald-400">No issues found — everything checked is in good condition.</p>
          )}
          {inspection.summary ? <div className="mt-5"><div className="card-title mb-1">Technician summary</div><p className="text-muted">{inspection.summary}</p></div> : null}
        </div>
        {settings.terms.diagram === "car" ? <div><CarDiagram items={inspection.items} /></div> : null}
      </div>

      <div className="mt-8 grid sm:grid-cols-2 gap-x-8 gap-y-5">
        {categories.map((cat) => (
          <div key={cat}>
            <div className="card-title mb-2">{cat}</div>
            <ul className="divide-y divide-border">
              {inspection.items.filter((i) => i.category === cat).map((i) => (
                <li key={i.id} className="py-1.5 flex items-start gap-2">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${INSPECTION_RESULT[i.result].dot}`} />
                  <span className="flex-1">{i.name}{i.notes ? <span className="block text-xs text-muted">{i.notes}</span> : null}</span>
                  <span className="text-xs text-muted">{INSPECTION_RESULT[i.result].label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {photos.length ? (
        <div className="mt-8">
          <div className="card-title mb-2">Photos</div>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photos.map((p) => (
              <li key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? ""} className="aspect-[4/3] w-full rounded-lg object-cover border border-border" />
                {p.caption ? <div className="text-xs text-muted mt-1">{p.caption}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-8 text-[11px] text-faint">Green = good · Amber = monitor / needs attention soon · Red = urgent, address now. Inspection performed at {settings.name}{technician ? ` by ${technician}` : ""} on {fmtDateTime(inspection.createdAt)}.</p>
    </div>
  );
}
