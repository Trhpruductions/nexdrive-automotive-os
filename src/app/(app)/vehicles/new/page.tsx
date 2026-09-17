import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { VehicleForm } from "../vehicle-form";

export const metadata = { title: "Add vehicle" };

export default async function NewVehiclePage({ searchParams }: { searchParams: Promise<{ customerId?: string; returnTo?: string }> }) {
  await requireStaff();
  const { customerId, returnTo } = await searchParams;
  const customers = await db.customer.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, company: true } });
  return (
    <div>
      <PageHeader title="Add vehicle" crumbs={[{ label: "Vehicles", href: "/vehicles" }, { label: "New" }]} />
      <VehicleForm values={{ customerId }} customers={customers} returnTo={returnTo} cancelHref={returnTo ?? (customerId ? `/customers/${customerId}` : "/vehicles")} />
    </div>
  );
}
