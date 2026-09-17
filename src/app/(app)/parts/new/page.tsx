import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { PartForm } from "../part-form";

export const metadata = { title: "Add part" };

export default async function NewPartPage() {
  await requireStaff();
  const [suppliers, cats] = await Promise.all([
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.part.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Add part" crumbs={[{ label: "Parts & Inventory", href: "/parts" }, { label: "New" }]} />
      <PartForm suppliers={suppliers} categories={cats.map((c) => c.category!)} cancelHref="/parts" />
    </div>
  );
}
