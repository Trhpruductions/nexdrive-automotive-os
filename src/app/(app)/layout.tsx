import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app/app-shell";
import { buildNav } from "@/lib/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const settings = await getSettings();
  const unread = await db.message.count({ where: { direction: "INBOUND", readAt: null } });
  const nav = buildNav(settings.modules, user.role);

  return (
    <AppShell nav={nav} user={{ name: user.name, role: user.role }} shopName={settings.name} logoUrl={settings.logoUrl} unread={unread}>
      {children}
    </AppShell>
  );
}
