import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { MODULES } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app/app-shell";
import { buildNav } from "@/lib/nav";
import { adminCloseShop } from "@/actions/platform";
import { rawDb } from "@/lib/db";
import { differenceInCalendarDays } from "date-fns";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const settings = await getSettings();
  const unread = await db.message.count({ where: { direction: "INBOUND", readAt: null } });
  const nav = buildNav(settings.modules, user.role === "SUPERADMIN" ? "OWNER" : user.role);
  const shop = user.activeShopId ? await rawDb.shop.findUnique({ where: { id: user.activeShopId }, select: { status: true, trialEndsAt: true } }) : null;
  const trialDays = shop?.status === "TRIAL" && shop.trialEndsAt ? differenceInCalendarDays(shop.trialEndsAt, new Date()) : null;
  const canBill = user.role === "OWNER" || user.role === "SUPERADMIN";

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
      {trialDays !== null && trialDays <= 7 ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200 flex flex-wrap items-center gap-3">
          <span>{trialDays > 0 ? `Your free trial ends in ${trialDays} day${trialDays === 1 ? "" : "s"}.` : "Your free trial ends today."} Pick a plan to keep everything running.</span>
          {canBill ? <Link href="/billing" className="btn btn-sm btn-primary ml-auto">Choose a plan</Link> : null}
        </div>
      ) : null}
      {shop?.status === "PAST_DUE" ? (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 flex flex-wrap items-center gap-3">
          <span>Your last NexDrive payment failed. Update your card to avoid interruption.</span>
          {canBill ? <Link href="/billing" className="btn btn-sm btn-primary ml-auto">Update billing</Link> : null}
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}
