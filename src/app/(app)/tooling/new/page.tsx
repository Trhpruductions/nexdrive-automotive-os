import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, Flash, PageHeader } from "@/components/ui";
import { DieForm } from "../die-form";

export const metadata = { title: "Add die" };

export default async function NewDiePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireStaff(MANAGER_ROLES);
  const sp = await searchParams;
  const presses = await db.machine.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
  return (
    <div>
      <PageHeader title="Add die" crumbs={[{ label: "Tooling", href: "/tooling" }, { label: "New" }]} />
      <Flash searchParams={sp} />
      <Card><DieForm presses={presses} /></Card>
    </div>
  );
}
