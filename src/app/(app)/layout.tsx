import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { MODULES } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app/app-shell";
import { buildNav } from "@/lib/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const settings = await getSettings();
  const unread = await db.message.count({ where: { direction: "INBOUND", readAt: null } });
  const nav = buildNav(settings.modules, user.role);

  // A module the shop turned off in Settings is hidden from the sidebar AND blocked by URL.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const hit = MODULES.find((m) => pathname === m.href || pathname.startsWith(m.href + "/"));
  if (hit && !settings.modules.includes(hit.key)) redirect("/dashboard?denied=1");

  return (
    <AppShell nav={nav} user={{ name: user.name, role: user.role }} shopName={settings.name} logoUrl={settings.logoUrl} unread={unread}>
      {children}
    </AppShell>
  );
}
