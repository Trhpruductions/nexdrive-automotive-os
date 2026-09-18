import { requireCustomer } from "@/lib/auth";
import { Card } from "@/components/ui";
import { PasswordForm } from "@/components/app/password-form";
import { ContactForm } from "./contact-form";
import { db } from "@/lib/db";

export const metadata = { title: "My account" };

export default async function PortalAccountPage() {
  const me = await requireCustomer();
  const c = await db.customer.findUniqueOrThrow({ where: { id: me.customerId }, select: { email: true, phone: true, address: true, city: true, state: true, zip: true } });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">My account</h1>
        <p className="text-sm text-muted">{me.name} · {me.email}</p>
      </div>
      <Card title="Contact details">
        <ContactForm values={c} />
      </Card>
      <Card title="Change password">
        <PasswordForm />
      </Card>
    </div>
  );
}
