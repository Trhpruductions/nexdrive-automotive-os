import { Save } from "lucide-react";
import { Field } from "@/components/ui";
import { saveDie } from "@/actions/production";

type Values = { id?: string; code?: string; name?: string; location?: string | null; machineId?: string | null; serviceIntervalHits?: number | null; hitCount?: number; status?: string; notes?: string | null };

export function DieForm({ values = {}, presses }: { values?: Values; presses: { id: string; code: string; name: string }[] }) {
  return (
    <form action={saveDie} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <Field label="Die code"><input name="code" required defaultValue={values.code ?? ""} className="input font-mono uppercase" placeholder="D-1042" /></Field>
      <Field label="Name"><input name="name" defaultValue={values.name ?? ""} className="input" placeholder="Bracket progressive die" /></Field>
      <Field label="Location / rack"><input name="location" defaultValue={values.location ?? ""} className="input" placeholder="Rack B-3" /></Field>
      <Field label="Mounted in press">
        <select name="machineId" defaultValue={values.machineId ?? ""} className="select"><option value="">— not mounted —</option>{presses.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select>
      </Field>
      <Field label="Service every (hits)" hint="Sharpen / inspect interval — blank for none"><input name="serviceIntervalHits" type="number" min={0} step={1000} defaultValue={values.serviceIntervalHits ?? ""} className="input" placeholder="250000" /></Field>
      {!values.id ? <Field label="Starting hit count"><input name="hitCount" type="number" min={0} defaultValue={values.hitCount ?? 0} className="input" /></Field> : (
        <Field label="Status"><select name="status" defaultValue={values.status ?? "ACTIVE"} className="select"><option value="ACTIVE">Active</option><option value="MAINTENANCE">In maintenance</option><option value="RETIRED">Retired</option></select></Field>
      )}
      <Field label="Notes" className="sm:col-span-2"><textarea name="notes" rows={3} defaultValue={values.notes ?? ""} className="textarea" placeholder="Shut height, feed pitch, tonnage, known issues…" /></Field>
      <div className="sm:col-span-2"><button className="btn btn-primary"><Save size={15} /> {values.id ? "Save die" : "Add die"}</button></div>
    </form>
  );
}
