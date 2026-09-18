import { requireStaff } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/constants";
import { PasswordForm } from "@/components/app/password-form";
import { signOutEverywhere } from "@/actions/auth";
import { Flash } from "@/components/ui";

export const metadata = { title: "My account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  return (
    <div>
      <PageHeader title="My account" subtitle={`${me.name} · ${me.email} · ${ROLE_LABEL[me.role]}`} />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Change password">
          <PasswordForm />
        </Card>
        <Card title="Signing in">
          <form action={signOutEverywhere} className="mb-4"><button className="btn btn-secondary">Sign out other devices</button><p className="text-xs text-faint mt-1">Phones, tablets and browsers signed in as you will need to sign in again. This one stays.</p></form>
          <p className="text-sm text-muted">Forgot your password on the sign-in screen? Use <span className="text-text">Forgot password</span> to get a one-hour reset link by email. Owners and admins can also set a new password for any staff member under Settings → Users &amp; roles.</p>
        </Card>
      </div>
    </div>
  );
}
