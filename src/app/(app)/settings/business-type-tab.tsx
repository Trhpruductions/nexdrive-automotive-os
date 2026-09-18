import { Save } from "lucide-react";
import { Card, Field } from "@/components/ui";
import { saveBusinessType } from "@/actions/settings";
import { VERTICALS, getVertical, type Terms } from "@/lib/verticals";
import type { ShopSettings } from "@/lib/settings";

/**
 * Settings → Business type: what the shop services. Picks the vocabulary
 * (Vehicle / Vessel / Device…), which fields show, and offers the type's
 * checklist + service packages as a one-click reset. Any word can be overridden.
 */
export function BusinessTypeTab({ s }: { s: ShopSettings }) {
  const v = getVertical(s.vertical);
  const base = v.terms;
  const custom = s.terms;
  const word = (k: keyof Terms) => (custom[k] !== base[k] ? String(custom[k] ?? "") : "");
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
      <Card title="Business type">
        <form action={saveBusinessType} className="space-y-5 max-w-2xl">
          <Field label="What do you service?" hint="Changes the words across the app, the customer portal and the booking page. Data is never changed.">
            <select name="vertical" defaultValue={s.vertical} className="select">
              {VERTICALS.map((x) => <option key={x.key} value={x.key}>{x.label} — {x.blurb}</option>)}
            </select>
          </Field>
          <div>
            <div className="card-title mb-2">Custom words (optional)</div>
            <p className="text-xs text-muted mb-3">Leave blank to use the business type&apos;s word, shown as the placeholder.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="One of them"><input name="asset" defaultValue={word("asset")} placeholder={base.asset} className="input" /></Field>
              <Field label="Several of them"><input name="assets" defaultValue={word("assets")} placeholder={base.assets} className="input" /></Field>
              <Field label="Identifier"><input name="serial" defaultValue={word("serial")} placeholder={base.serial} className="input" /></Field>
              <Field label="Tag / registration" hint="Type “none” to hide"><input name="plate" defaultValue={custom.plate === null && base.plate !== null ? "none" : word("plate")} placeholder={base.plate ?? "none"} className="input" /></Field>
              <Field label="Usage counter" hint="Type “none” to hide"><input name="odometer" defaultValue={custom.odometer === null && base.odometer !== null ? "none" : word("odometer")} placeholder={base.odometer ?? "none"} className="input" /></Field>
              <Field label="Counter unit"><input name="odometerUnit" defaultValue={word("odometerUnit")} placeholder={base.odometerUnit || "—"} className="input" /></Field>
              <Field label="Make / brand label"><input name="make" defaultValue={word("make")} placeholder={base.make} className="input" /></Field>
              <Field label="Model label"><input name="model" defaultValue={word("model")} placeholder={base.model} className="input" /></Field>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="resetDefaults" className="mt-1 accent-[var(--accent)]" />
            <span>Also replace my inspection checklist and service packages with the <span className="text-text">{v.label}</span> defaults <span className="text-xs text-muted block">Use this when switching type — existing work orders and history are untouched.</span></span>
          </label>
          <button className="btn btn-primary"><Save size={15} /> Save business type</button>
        </form>
      </Card>
      <Card title={`${v.label} starts with`}>
        <div className="text-xs text-muted mb-1">Checklist</div>
        <ul className="text-sm mb-4 space-y-0.5">{v.inspection.map(([cat, items]) => <li key={cat}><span className="font-medium">{cat}</span> <span className="text-muted">· {items.length} items</span></li>)}</ul>
        <div className="text-xs text-muted mb-1">Service packages</div>
        <ul className="text-sm space-y-0.5">{v.cannedServices.map((c) => <li key={c.name}>{c.name} <span className="text-muted">· {c.laborHours} h</span></li>)}</ul>
        {v.modulesOff.length ? <p className="text-xs text-faint mt-4">Modules off by default for this type: {v.modulesOff.join(", ")} (change under Modules).</p> : null}
      </Card>
    </div>
  );
}
