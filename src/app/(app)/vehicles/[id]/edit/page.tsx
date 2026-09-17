import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { vehicleName } from "@/lib/format";
import { VehicleForm } from "../../vehicle-form";

export const metadata = { title: "Edit vehicle" };

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const [v, customers] = await Promise.all([
    db.vehicle.findUnique({ where: { id } }),
    db.customer.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, company: true } }),
  ]);
  if (!v) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${vehicleName(v)}`} crumbs={[{ label: "Vehicles", href: "/vehicles" }, { label: vehicleName(v), href: `/vehicles/${id}` }, { label: "Edit" }]} />
      <VehicleForm values={v} customers={customers} cancelHref={`/vehicles/${id}`} />
    </div>
  );
}
