import { requireStaff } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/constants";
import { PasswordForm } from "@/components/app/password-form";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const me = await requireStaff();
  return (
    <div>
      <PageHeader title="My account" subtitle={`${me.name} · ${me.email} · ${ROLE_LABEL[me.role]}`} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Change password">
          <PasswordForm />
        </Card>
        <Card title="Signing in">
          <p className="text-sm text-muted">Forgot your password on the sign-in screen? Use <span className="text-text">Forgot password</span> to get a one-hour reset link by email. Owners and admins can also set a new password for any staff member under Settings → Users &amp; roles.</p>
        </Card>
      </div>
    </div>
  );
}
