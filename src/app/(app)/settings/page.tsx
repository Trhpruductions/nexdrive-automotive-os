import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Field, Flash, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { MODULES, ROLE_LABEL, US_STATES } from "@/lib/constants";
import { money } from "@/lib/format";
import { addBay, addTemplateItem, createUser, deleteBay, deleteCannedService, deleteTemplateItem, moveTemplateItem, saveBranding, saveBusiness, saveModules, saveRates, saveTemplates, toggleBay, updateUser } from "@/actions/settings";
import { DEFAULT_TEMPLATES, TEMPLATE_EVENTS } from "@/lib/templates";
import { CannedServiceEditor } from "./canned-service-editor";
import { IntegrationsTab } from "./integrations-tab";
import { ApiTab } from "./api-tab";

export const metadata = { title: "Settings" };

const TABS = [
  { key: "branding", label: "Branding" },
  { key: "business", label: "Business" },
  { key: "rates", label: "Rates & hours" },
  { key: "bays", label: "Bays" },
  { key: "modules", label: "Modules" },
  { key: "inspection", label: "Inspection checklist" },
  { key: "services", label: "Canned services" },
  { key: "templates", label: "Notification templates" },
  { key: "users", label: "Users & roles" },
  { key: "integrations", label: "Integrations" },
  { key: "api", label: "API & Webhooks" },
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; error?: string; edit?: string; newKey?: string; newId?: string; newSecret?: string; newHook?: string }> }) {
  const me = await requireStaff(MANAGER_ROLES);
  const s = await getSettings();
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "branding";

  return (
    <div>
      <PageHeader title="Settings" subtitle={`Tailor NexDrive to how ${s.name} runs. Changes apply instantly for everyone.`} />
      <Flash searchParams={sp} />
      <div className="flex gap-1.5 overflow-x-auto pb-4 -mx-1 px-1">
        {TABS.map((t) => (
          <Link key={t.key} href={`/settings?tab=${t.key}`} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border ${tab === t.key ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-text"}`}>{t.label}</Link>
        ))}
      </div>

      {tab === "branding" ? (
        <Card title="Branding">
          <form action={saveBranding} className="grid sm:grid-cols-2 gap-4 max-w-3xl">
            <Field label="Shop name"><input name="name" required defaultValue={s.name} className="input" /></Field>
            <Field label="Tagline"><input name="tagline" defaultValue={s.tagline} className="input" /></Field>
            <Field label="Accent color" hint="Buttons, active nav, highlights">
              <div className="flex items-center gap-3"><input name="accentColor" type="color" defaultValue={s.accentColor} className="input h-10 w-20 p-1" /><span className="text-xs text-muted font-mono">{s.accentColor}</span></div>
            </Field>
            <Field label="Logo" hint="Shown on the sidebar, login, invoices and portal. PNG/SVG with transparency works best.">
              <div className="flex items-center gap-3">
                {s.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover bg-bg-elevated" />
                ) : (
                  <Image src="/brand/mark.png" alt="" width={48} height={48} />
                )}
                <input type="file" name="logo" accept="image/*" className="input file:mr-3 file:rounded-md file:border-0 file:bg-card-hover file:px-3 file:py-1 file:text-xs file:text-text" />
              </div>
              {s.logoUrl ? <label className="flex items-center gap-2 text-xs text-muted mt-2"><input type="checkbox" name="removeLogo" value="true" /> Remove custom logo (use NexDrive mark)</label> : null}
            </Field>
            <Field label="Customer portal welcome" className="sm:col-span-2"><textarea name="portalWelcome" rows={2} defaultValue={s.portalWelcome ?? ""} className="textarea" /></Field>
            <Field label="Estimate approval message" className="sm:col-span-2"><textarea name="approvalMessage" rows={2} defaultValue={s.approvalMessage ?? ""} className="textarea" /></Field>
            <Field label="Invoice footer / warranty text" className="sm:col-span-2"><textarea name="invoiceFooter" rows={2} defaultValue={s.invoiceFooter ?? ""} className="textarea" /></Field>
            <div className="sm:col-span-2"><button className="btn btn-primary"><Save size={15} /> Save branding</button></div>
          </form>
        </Card>
      ) : null}

      {tab === "business" ? (
        <Card title="Business details">
          <form action={saveBusiness} className="grid sm:grid-cols-2 gap-4 max-w-3xl">
            <Field label="Phone"><input name="phone" defaultValue={s.phone ?? ""} className="input" /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={s.email ?? ""} className="input" /></Field>
            <Field label="Website" className="sm:col-span-2"><input name="website" defaultValue={s.website ?? ""} className="input" /></Field>
            <Field label="Street address" className="sm:col-span-2"><input name="address" defaultValue={s.address ?? ""} className="input" /></Field>
            <Field label="City"><input name="city" defaultValue={s.city ?? ""} className="input" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="State"><select name="state" defaultValue={s.state ?? ""} className="select"><option value="">—</option>{US_STATES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
              <Field label="ZIP"><input name="zip" defaultValue={s.zip ?? ""} className="input" /></Field>
            </div>
            <Field label="Time zone"><input name="timezone" defaultValue={s.timezone} className="input" placeholder="America/Denver" /></Field>
            <Field label="Currency"><select name="currency" defaultValue={s.currency} className="select">{["USD", "CAD", "EUR", "GBP", "AUD", "MXN"].map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
            <div className="sm:col-span-2"><button className="btn btn-primary"><Save size={15} /> Save details</button></div>
          </form>
        </Card>
      ) : null}

      {tab === "rates" ? (
        <Card title="Rates & hours">
          <form action={saveRates} className="grid sm:grid-cols-2 gap-4 max-w-3xl">
            <Field label="Sales tax rate (%)" hint="Applied to taxable lines (parts by default)"><input name="taxRate" type="number" step="0.001" min="0" max="99" defaultValue={(s.taxRate * 100).toFixed(3)} className="input" /></Field>
            <Field label="Labor rate ($/hour)" hint="Default when adding labor lines"><input name="laborRate" type="number" step="0.01" min="0" defaultValue={s.laborRate} className="input" /></Field>
            <Field label="Shop supplies fee (%)" hint="Suggested on new estimates"><input name="shopFeeRate" type="number" step="0.01" min="0" max="99" defaultValue={(s.shopFeeRate * 100).toFixed(2)} className="input" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Opens"><input name="openTime" type="time" defaultValue={s.openTime} className="input" /></Field>
              <Field label="Closes"><input name="closeTime" type="time" defaultValue={s.closeTime} className="input" /></Field>
            </div>
            <div className="sm:col-span-2"><button className="btn btn-primary"><Save size={15} /> Save rates</button></div>
          </form>
        </Card>
      ) : null}

      {tab === "bays" ? <BaysTab /> : null}

      {tab === "modules" ? (
        <Card title="Modules" action={<span className="text-xs text-muted">Turn off anything your shop doesn&apos;t use — it disappears from the sidebar for everyone.</span>}>
          <form action={saveModules} className="space-y-4 max-w-3xl">
            <div className="grid sm:grid-cols-2 gap-2">
              {MODULES.map((m) => (
                <label key={m.key} className="card card-hover p-3 flex items-start gap-3 cursor-pointer has-[:checked]:border-accent/60">
                  <input type="checkbox" name="modules" value={m.key} defaultChecked={s.modules.includes(m.key)} className="mt-1 accent-[var(--accent)]" />
                  <span><span className="text-sm font-medium">{m.label}</span><span className="block text-xs text-muted">{m.description}</span></span>
                </label>
              ))}
            </div>
            <button className="btn btn-primary"><Save size={15} /> Save modules</button>
          </form>
        </Card>
      ) : null}

      {tab === "inspection" ? <InspectionTab /> : null}
      {tab === "services" ? <ServicesTab edit={sp.edit} /> : null}
      {tab === "templates" ? (
        <Card title="Notification templates" action={<span className="text-xs text-muted">Blank = built-in default. Placeholders in braces are filled per message.</span>}>
          <form action={saveTemplates} className="space-y-5 max-w-3xl">
            {TEMPLATE_EVENTS.map((ev) => {
              const custom = s.templates?.[ev.key];
              return (
                <div key={ev.key} className="card p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-sm">{ev.label}</span><span className="text-[11px] text-faint font-mono">{ev.vars.map((v) => `{${v}}`).join(" ")}</span></div>
                  <input name={`${ev.key}_subject`} defaultValue={custom?.subject ?? ""} placeholder={DEFAULT_TEMPLATES[ev.key].subject} className="input" />
                  <textarea name={`${ev.key}_body`} rows={2} defaultValue={custom?.body ?? ""} placeholder={DEFAULT_TEMPLATES[ev.key].body} className="textarea" />
                </div>
              );
            })}
            <button className="btn btn-primary"><Save size={15} /> Save templates</button>
          </form>
        </Card>
      ) : null}
      {tab === "users" ? <UsersTab meId={me.id} meRole={me.role} /> : null}
      {tab === "integrations" ? <IntegrationsTab newKey={sp.newKey} newId={sp.newId} /> : null}
      {tab === "api" ? <ApiTab newKey={sp.newKey} newId={sp.newId} newSecret={sp.newSecret} newHook={sp.newHook} /> : null}
    </div>
  );
}

async function BaysTab() {
  const bays = await db.bay.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { appointments: true } } } });
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card title="Add bay / lift">
        <form action={addBay} className="flex gap-2"><input name="name" required placeholder="Bay 5, Alignment rack, Detail…" className="input" /><button className="btn btn-primary shrink-0"><Plus size={15} /> Add</button></form>
      </Card>
      <Card className="lg:col-span-2" title="Bays" padded={false}>
        <table className="table">
          <thead><tr><th>Bay</th><th>Status</th><th className="text-right">Appointments</th><th></th></tr></thead>
          <tbody>
            {bays.map((b) => (
              <tr key={b.id}>
                <td className="font-medium">{b.name}</td>
                <td>{b.active ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Disabled</Badge>}</td>
                <td className="text-right tabular-nums">{b._count.appointments}</td>
                <td className="text-right"><div className="flex justify-end gap-1"><form action={toggleBay.bind(null, b.id)}><button className="btn btn-ghost btn-sm">{b.active ? "Disable" : "Enable"}</button></form><form action={deleteBay.bind(null, b.id)}><ConfirmButton message="Remove this bay?" className="btn btn-ghost btn-sm text-faint hover:text-red-400"><Trash2 size={13} /></ConfirmButton></form></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

async function InspectionTab() {
  const items = await db.inspectionTemplateItem.findMany({ orderBy: { sortOrder: "asc" } });
  const categories = [...new Set(items.map((i) => i.category))];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card title="Add checklist item">
        <form action={addTemplateItem} className="space-y-3">
          <input name="category" list="insp-cats" required placeholder="Category (Exterior, Under Hood…)" className="input" />
          <datalist id="insp-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <input name="name" required placeholder="Item (e.g. Front brake pads)" className="input" />
          <button className="btn btn-primary w-full"><Plus size={15} /> Add item</button>
        </form>
        <p className="text-xs text-faint mt-4">New inspections copy this checklist. Existing inspections keep what they were started with.</p>
      </Card>
      <Card className="lg:col-span-2" title={`Checklist (${items.length} points)`} padded={false}>
        {categories.map((cat) => (
          <div key={cat}>
            <div className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-accent bg-bg-elevated border-y border-border">{cat}</div>
            <ul className="divide-y divide-border">
              {items.filter((i) => i.category === cat).map((i) => (
                <li key={i.id} className="px-5 py-2 flex items-center gap-2 text-sm">
                  <span className="flex-1">{i.name}</span>
                  <form action={moveTemplateItem.bind(null, i.id, -1)}><button className="btn btn-ghost btn-sm" aria-label="Move up"><ArrowUp size={13} /></button></form>
                  <form action={moveTemplateItem.bind(null, i.id, 1)}><button className="btn btn-ghost btn-sm" aria-label="Move down"><ArrowDown size={13} /></button></form>
                  <form action={deleteTemplateItem.bind(null, i.id)}><button className="btn btn-ghost btn-sm text-faint hover:text-red-400" aria-label="Delete"><Trash2 size={13} /></button></form>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </div>
  );
}

async function ServicesTab({ edit }: { edit?: string }) {
  const [services, parts] = await Promise.all([
    db.cannedService.findMany({ orderBy: { name: "asc" }, include: { parts: { include: { part: true } } } }),
    db.part.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, price: true } }),
  ]);
  const editing = services.find((x) => x.id === edit);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <Card className="lg:col-span-2" title={editing ? `Edit ${editing.name}` : "New canned service"}>
        <CannedServiceEditor key={editing?.id ?? "new"} parts={parts.map((p) => ({ ...p, price: Number(p.price) }))} initial={editing ? { id: editing.id, name: editing.name, description: editing.description, laborHours: Number(editing.laborHours), laborRate: editing.laborRate ? Number(editing.laborRate) : null, parts: editing.parts.map((p) => ({ partId: p.partId, quantity: Number(p.quantity) })) } : undefined} />
      </Card>
      <Card className="lg:col-span-3" title="Canned services" padded={false}>
        <table className="table">
          <thead><tr><th>Service</th><th className="text-right">Labor</th><th>Parts</th><th></th></tr></thead>
          <tbody>
            {services.map((svc) => (
              <tr key={svc.id}>
                <td><Link href={`/settings?tab=services&edit=${svc.id}`} className="font-medium hover:text-accent">{svc.name}</Link>{svc.description ? <div className="text-xs text-muted">{svc.description}</div> : null}</td>
                <td className="text-right tabular-nums text-sm">{Number(svc.laborHours)} h{svc.laborRate ? <div className="text-xs text-muted">@ {money(svc.laborRate)}</div> : null}</td>
                <td className="text-xs text-muted">{svc.parts.map((p) => `${Number(p.quantity)}× ${p.part.name}`).join(", ") || "—"}</td>
                <td className="text-right"><form action={deleteCannedService.bind(null, svc.id)}><ConfirmButton message="Remove this canned service?" className="btn btn-ghost btn-sm text-faint hover:text-red-400"><Trash2 size={13} /></ConfirmButton></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

async function UsersTab({ meId, meRole }: { meId: string; meRole: string }) {
  const users = await db.user.findMany({ where: { role: { not: "CUSTOMER" } }, orderBy: [{ role: "asc" }, { name: "asc" }] });
  const roles = ["OWNER", "ADMIN", "SERVICE_ADVISOR", "TECHNICIAN"] as const;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card title="Add staff login">
        <form action={createUser} className="space-y-3">
          <input name="name" required placeholder="Full name" className="input" />
          <input name="email" type="email" required placeholder="Email" className="input" />
          <select name="role" className="select" defaultValue="SERVICE_ADVISOR">{roles.filter((r) => r !== "OWNER" || meRole === "OWNER").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          <input name="password" type="password" minLength={8} required placeholder="Password (8+ chars)" className="input" autoComplete="new-password" />
          <button className="btn btn-primary w-full"><Plus size={15} /> Add user</button>
        </form>
        <div className="mt-5 pt-4 border-t border-border text-xs text-muted space-y-1">
          <div><strong className="text-text">Owner / Admin</strong> — everything incl. settings, users, reports</div>
          <div><strong className="text-text">Service advisor</strong> — customers, estimates, invoices, payments, schedule</div>
          <div><strong className="text-text">Technician</strong> — assigned jobs, inspections, time clock, parts lookup</div>
        </div>
      </Card>
      <Card className="lg:col-span-2" title="Staff" padded={false}>
        <table className="table">
          <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Reset password</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><div className="font-medium">{u.name}{u.id === meId ? <span className="text-xs text-muted"> (you)</span> : null}</div><div className="text-xs text-muted">{u.email}</div></td>
                <td><select form={`u-${u.id}`} name="role" defaultValue={u.role} className="select py-1.5 text-xs w-40" disabled={u.id === meId || (u.role === "OWNER" && meRole !== "OWNER")}>{roles.filter((r) => r !== "OWNER" || meRole === "OWNER").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
                <td><select form={`u-${u.id}`} name="active" defaultValue={u.active ? "true" : "false"} className="select py-1.5 text-xs w-28" disabled={u.id === meId}><option value="true">Active</option><option value="false">Disabled</option></select></td>
                <td><input form={`u-${u.id}`} name="password" type="password" placeholder="New password" className="input py-1.5 text-xs" autoComplete="new-password" /></td>
                <td className="text-right"><form id={`u-${u.id}`} action={updateUser.bind(null, u.id)}><button className="btn btn-secondary btn-sm"><Save size={13} /> Save</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
