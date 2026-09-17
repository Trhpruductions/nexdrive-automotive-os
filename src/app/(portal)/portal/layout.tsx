import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { getSettings, shopAddress } from "@/lib/settings";
import { db } from "@/lib/db";
import { logout } from "@/actions/auth";
import { PortalNav } from "./portal-nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCustomer();
  const s = await getSettings();
  const [unreadMsgs, unreadNotes] = await Promise.all([
    db.message.count({ where: { customerId: user.customerId, direction: "OUTBOUND", readAt: null } }),
    db.notification.count({ where: { customerId: user.customerId, channel: "PORTAL", readAt: null } }),
  ]);

  return (
    <div className="app-canvas min-h-screen flex flex-col">
      <header className="border-b border-border bg-bg/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <Link href="/portal" className="flex items-center gap-2.5">
            {s.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <Image src="/brand/mark.png" alt="" width={36} height={36} />
            )}
            <span className="leading-tight"><span className="block font-semibold text-sm">{s.name}</span><span className="block text-[10px] text-muted uppercase tracking-wider">Customer portal</span></span>
          </Link>
          <PortalNav unreadMessages={unreadMsgs} unreadNotifications={unreadNotes} />
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:block text-sm text-muted">{user.name}</span>
            <form action={logout}><button className="btn btn-ghost btn-sm"><LogOut size={14} /> Sign out</button></form>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6">{children}</main>
      <footer className="border-t border-border py-5 text-center text-xs text-faint">
        {s.name} · {shopAddress(s).join(", ")} · {s.phone} · Powered by NexDrive Automotive OS
      </footer>
    </div>
  );
}
