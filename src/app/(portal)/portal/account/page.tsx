import { requireCustomer } from "@/lib/auth";
import { Card } from "@/components/ui";
import { PasswordForm } from "@/components/app/password-form";

export const metadata = { title: "My account" };

export default async function PortalAccountPage() {
  const me = await requireCustomer();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">My account</h1>
        <p className="text-sm text-muted">{me.name} · {me.email}</p>
      </div>
      <Card title="Change password">
        <PasswordForm />
      </Card>
    </div>
  );
}
