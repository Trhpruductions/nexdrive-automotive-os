import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { VehicleForm } from "../vehicle-form";
import { getSettings } from "@/lib/settings";


export default async function NewVehiclePage({ searchParams }: { searchParams: Promise<{ customerId?: string; returnTo?: string }> }) {
  await requireStaff();
  const { terms } = await getSettings();
  const { customerId, returnTo } = await searchParams;
  const customers = await db.customer.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, company: true } });
  return (
    <div>
      <PageHeader title={`Add ${terms.asset.toLowerCase()}`} crumbs={[{ label: terms.assets, href: "/vehicles" }, { label: "New" }]} />
      <VehicleForm values={{ customerId }} customers={customers} returnTo={returnTo} cancelHref={returnTo ?? (customerId ? `/customers/${customerId}` : "/vehicles")} terms={terms} />
    </div>
  );
}
