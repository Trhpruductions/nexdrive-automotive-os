import { notFound } from "next/navigation";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { TechForm } from "../../tech-form";

export const metadata = { title: "Edit technician" };

export default async function EditTechnicianPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(BILLING_ROLES);
  const { id } = await params;
  const t = await db.technician.findUnique({ where: { id }, include: { user: true } });
  if (!t) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${t.name}`} crumbs={[{ label: "Technicians", href: "/technicians" }, { label: t.name, href: `/technicians/${id}` }, { label: "Edit" }]} />
      <TechForm values={{ ...t, hourlyRate: Number(t.hourlyRate), hasLogin: Boolean(t.user) }} cancelHref={`/technicians/${id}`} />
    </div>
  );
}
