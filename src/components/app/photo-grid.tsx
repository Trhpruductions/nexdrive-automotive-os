import { Camera, Trash2 } from "lucide-react";
import { addVehiclePhoto, deleteVehiclePhoto } from "@/actions/vehicles";
import { ConfirmButton } from "./confirm-button";
import { fmtDate } from "@/lib/format";

type Photo = { id: string; url: string; caption: string | null; kind: string; createdAt: Date };

/** Photo gallery + upload form shared by vehicle profile, work order and inspection screens. */
export function PhotoGrid({
  photos,
  vehicleId,
  workOrderId,
  returnTo,
  compact = false,
}: {
  photos: Photo[];
  vehicleId: string;
  workOrderId?: string;
  returnTo: string;
  compact?: boolean;
}) {
  return (
    <div className="space-y-4">
      {photos.length ? (
        <ul className={`grid gap-3 ${compact ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
          {photos.map((p) => (
            <li key={p.id} className="group relative rounded-lg overflow-hidden border border-border bg-bg-elevated">
              <a href={p.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? ""} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              </a>
              <div className="px-2 py-1.5 text-[11px] flex items-center justify-between gap-2">
                <span className="truncate">
                  <span className="text-accent font-semibold uppercase mr-1">{p.kind.toLowerCase()}</span>
                  <span className="text-muted">{p.caption ?? fmtDate(p.createdAt)}</span>
                </span>
                <form action={deleteVehiclePhoto.bind(null, p.id, returnTo)}>
                  <ConfirmButton message="Delete this photo?" className="text-faint hover:text-red-400"><Trash2 size={12} /></ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No photos yet.</p>
      )}
      <form action={addVehiclePhoto.bind(null, vehicleId)} className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        {workOrderId ? <input type="hidden" name="workOrderId" value={workOrderId} /> : null}
        <label className="block flex-1 min-w-[180px]">
          <span className="label">Add photo</span>
          <input type="file" name="photo" accept="image/*" capture="environment" required className="input file:mr-3 file:rounded-md file:border-0 file:bg-card-hover file:px-3 file:py-1 file:text-xs file:text-text" />
        </label>
        <label className="block w-36">
          <span className="label">Type</span>
          <select name="kind" className="select">
            {["GENERAL", "DAMAGE", "INSPECTION", "BEFORE", "AFTER"].map((k) => <option key={k} value={k}>{k[0] + k.slice(1).toLowerCase()}</option>)}
          </select>
        </label>
        <label className="block flex-1 min-w-[160px]">
          <span className="label">Caption</span>
          <input name="caption" className="input" placeholder="Optional" />
        </label>
        <button className="btn btn-primary"><Camera size={16} /> Upload</button>
      </form>
    </div>
  );
}
