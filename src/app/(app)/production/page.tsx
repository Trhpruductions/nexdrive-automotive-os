import Link from "next/link";
import { BarChart3, Plus, Settings2, Trash2 } from "lucide-react";
import { requireStaff, can, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { productionSnapshot } from "@/lib/integrations/snapshot";
import { Card, Flash, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { deleteLine, saveLine, saveMachine } from "@/actions/integrations";
import { LiveFloor } from "./live-floor";

export const metadata = { title: "Production" };
export const dynamic = "force-dynamic";

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; manage?: string }> }) {
  const user = await requireStaff();
  const sp = await searchParams;
  const [snap, lines] = await Promise.all([productionSnapshot(), db.productionLine.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })]);
  const manager = can(user, MANAGER_ROLES);

  return (
    <div>
      <PageHeader
        title="Production floor"
        subtitle="Live status, counts and readings from every connected machine and line — plus inventory as it changes."
        actions={
          <>
            {manager ? <Link href="/production/report" className="btn btn-secondary"><BarChart3 size={15} /> Shift & OEE</Link> : null}
            {manager ? <Link href="/settings?tab=integrations" className="btn btn-secondary"><Settings2 size={15} /> Feeds</Link> : null}
            {manager ? <Link href={sp.manage ? "/production" : "/production?manage=1"} className="btn btn-primary"><Plus size={15} /> {sp.manage ? "Hide setup" : "Lines & machines"}</Link> : null}
          </>
        }
      />
      <Flash searchParams={sp} />

      {manager && sp.manage ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          <Card title="Production lines">
            <form action={saveLine} className="grid grid-cols-[1fr_1fr_90px_auto] gap-2 items-end mb-4">
              <label className="block"><span className="label">Name</span><input name="name" required className="input" placeholder="Line A" /></label>
              <label className="block"><span className="label">Description</span><input name="description" className="input" placeholder="Brake rotor cell" /></label>
              <label className="block"><span className="label">Target / hr</span><input name="targetPerHour" type="number" min="0" className="input" /></label>
              <button className="btn btn-primary"><Plus size={14} /> Add</button>
            </form>
            <ul className="divide-y divide-border text-sm">
              {lines.map((l) => (
                <li key={l.id} className="py-2 flex items-center gap-2">
                  <form action={saveLine} className="flex-1 grid grid-cols-[1fr_1fr_80px_auto] gap-2 items-center">
                    <input type="hidden" name="id" value={l.id} />
                    <input name="name" defaultValue={l.name} className="input py-1.5" />
                    <input name="description" defaultValue={l.description ?? ""} className="input py-1.5" />
                    <input name="targetPerHour" type="number" min="0" defaultValue={l.targetPerHour ?? ""} className="input py-1.5" />
                    <button className="btn btn-ghost btn-sm">Save</button>
                  </form>
                  <form action={deleteLine.bind(null, l.id)}><ConfirmButton message="Remove this line? Machines stay but become unassigned." className="btn btn-ghost btn-sm text-faint hover:text-red-400"><Trash2 size={13} /></ConfirmButton></form>
                </li>
              ))}
              {!lines.length ? <li className="py-3 text-muted">No lines yet — lines are also auto-created when a feed mentions one.</li> : null}
            </ul>
          </Card>
          <Card title="Add machine manually">
            <form action={saveMachine} className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">Code (matches the feed)</span><input name="code" required className="input font-mono uppercase" placeholder="CNC-01" /></label>
              <label className="block"><span className="label">Display name</span><input name="name" className="input" placeholder="Haas VF-2" /></label>
              <label className="block"><span className="label">Type</span><input name="type" className="input" placeholder="CNC mill, press, lift, dyno…" /></label>
              <label className="block"><span className="label">Line</span><select name="lineId" className="select" defaultValue=""><option value="">Unassigned</option>{lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
              <label className="block col-span-2"><span className="label">Notes</span><input name="notes" className="input" placeholder="Gateway IP, PLC tag names, contact…" /></label>
              <div className="col-span-2"><button className="btn btn-primary"><Plus size={14} /> Add machine</button></div>
            </form>
            <p className="text-xs text-faint mt-3">Machines are also created automatically the first time a feed reports them — the code in the feed must match this code.</p>
          </Card>
        </div>
      ) : null}

      <LiveFloor initial={snap} />
    </div>
  );
}
