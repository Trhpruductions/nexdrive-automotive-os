import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TechForm } from "../tech-form";

export const metadata = { title: "Add technician" };

export default async function NewTechnicianPage() {
  await requireStaff(BILLING_ROLES);
  return (
    <div>
      <PageHeader title="Add technician" crumbs={[{ label: "Technicians", href: "/technicians" }, { label: "New" }]} />
      <TechForm cancelHref="/technicians" />
    </div>
  );
}
