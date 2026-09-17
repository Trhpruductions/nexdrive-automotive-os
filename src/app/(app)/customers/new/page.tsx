import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../customer-form";

export const metadata = { title: "New customer" };

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  await requireStaff();
  const { returnTo } = await searchParams;
  return (
    <div>
      <PageHeader title="New customer" crumbs={[{ label: "Customers", href: "/customers" }, { label: "New" }]} />
      <CustomerForm returnTo={returnTo} cancelHref={returnTo ?? "/customers"} />
    </div>
  );
}
