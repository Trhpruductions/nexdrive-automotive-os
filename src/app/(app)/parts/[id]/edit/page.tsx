import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { PartForm } from "../../part-form";

export const metadata = { title: "Edit part" };

export default async function EditPartPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const [p, suppliers, cats] = await Promise.all([
    db.part.findUnique({ where: { id } }),
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.part.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true } }),
  ]);
  if (!p) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${p.name}`} crumbs={[{ label: "Parts & Inventory", href: "/parts" }, { label: p.name, href: `/parts/${id}` }, { label: "Edit" }]} />
      <PartForm values={{ ...p, cost: Number(p.cost), price: Number(p.price) }} suppliers={suppliers} categories={cats.map((c) => c.category!)} cancelHref={`/parts/${id}`} />
    </div>
  );
}
