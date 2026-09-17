import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../../customer-form";

export const metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const c = await db.customer.findUnique({ where: { id } });
  if (!c) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${c.firstName} ${c.lastName}`} crumbs={[{ label: "Customers", href: "/customers" }, { label: `${c.firstName} ${c.lastName}`, href: `/customers/${id}` }, { label: "Edit" }]} />
      <CustomerForm values={c} cancelHref={`/customers/${id}`} />
    </div>
  );
}
