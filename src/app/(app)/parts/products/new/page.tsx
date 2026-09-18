import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { Card, Flash, PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";
import { productOptions } from "../options";

export const metadata = { title: "Add product" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireStaff(MANAGER_ROLES);
  const sp = await searchParams;
  const opts = await productOptions();
  return (
    <div>
      <PageHeader title="Add product" crumbs={[{ label: "Parts & Inventory", href: "/parts" }, { label: "Products", href: "/parts/products" }, { label: "New" }]} />
      <Flash searchParams={sp} />
      <Card><ProductForm {...opts} /></Card>
    </div>
  );
}
