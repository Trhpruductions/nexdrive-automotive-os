import "server-only";
import { db } from "@/lib/db";

/** Dropdown data for the product form. */
export async function productOptions() {
  const [customers, dies, presses, materials] = await Promise.all([
    db.customer.findMany({ orderBy: [{ company: "asc" }, { lastName: "asc" }], select: { id: true, company: true, firstName: true, lastName: true } }),
    db.die.findMany({ where: { status: { not: "RETIRED" } }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    db.machine.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    db.part.findMany({ where: { kind: "MATERIAL", active: true }, orderBy: { name: "asc" }, select: { id: true, sku: true, name: true, unit: true } }),
  ]);
  return {
    customers: customers.map((c) => ({ id: c.id, label: c.company ?? `${c.firstName} ${c.lastName}` })),
    dies: dies.map((d) => ({ id: d.id, label: `${d.code} · ${d.name}` })),
    presses: presses.map((p) => ({ id: p.id, label: `${p.code} · ${p.name}` })),
    materials: materials.map((m) => ({ id: m.id, label: `${m.sku} · ${m.name} (${m.unit})` })),
  };
}
