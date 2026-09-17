import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { MODULES } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app/app-shell";
import { buildNav } from "@/lib/nav";
import { adminCloseShop } from "@/actions/platform";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const settings = await getSettings();
  const unread = await db.message.count({ where: { direction: "INBOUND", readAt: null } });
  const nav = buildNav(settings.modules, user.role === "SUPERADMIN" ? "OWNER" : user.role);

  // A module the shop turned off in Settings is hidden from the sidebar AND blocked by URL.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const hit = MODULES.find((m) => pathname === m.href || pathname.startsWith(m.href + "/"));
  if (hit && !settings.modules.includes(hit.key)) redirect("/dashboard?denied=1");

  return (
    <AppShell nav={nav} user={{ name: user.name, role: user.role }} shopName={settings.name} logoUrl={settings.logoUrl} unread={unread}>
      {user.role === "SUPERADMIN" ? (
        <div className="mb-4 rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm text-violet-200 flex flex-wrap items-center gap-3">
          <span>Viewing <strong>{settings.name}</strong> as NexDrive platform admin.</span>
          <form action={adminCloseShop} className="ml-auto"><button className="btn btn-ghost btn-sm">Back to admin console</button></form>
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}
