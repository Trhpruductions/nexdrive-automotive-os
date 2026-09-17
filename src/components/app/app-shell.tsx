"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Calendar, Car, ChevronDown, LayoutDashboard, LogOut, Menu, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { Sidebar } from "./sidebar";
import type { NavItem } from "@/lib/nav";
import { logout } from "@/actions/auth";
import { ROLE_LABEL } from "@/lib/constants";
import { initials } from "@/lib/format";

export function AppShell({
  nav,
  user,
  shopName,
  logoUrl,
  unread,
  children,
}: {
  nav: NavItem[];
  user: { name: string; role: string };
  shopName: string;
  logoUrl: string | null;
  unread: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  const tab = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="app-canvas min-h-screen">
      <Sidebar nav={nav} shopName={shopName} logoUrl={logoUrl} open={open} onClose={() => setOpen(false)} />

      <div className="lg:pl-[var(--sidebar-w)] flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-16 flex items-center gap-3 px-4 sm:px-6 bg-bg/80 backdrop-blur border-b border-border">
          <button className="btn btn-ghost btn-sm lg:hidden -ml-2" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>

          <form onSubmit={submitSearch} className="ml-auto relative w-full max-w-xs sm:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search anything…"
              className="input pl-9 pr-8 py-2 text-[13px]"
              aria-label="Search"
            />
            {q ? (
              <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-text" aria-label="Clear">
                <X size={14} />
              </button>
            ) : null}
          </form>

          <Link href="/notifications" className="btn btn-ghost btn-sm relative" aria-label="Notifications">
            <Bell size={18} />
            {unread > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-accent text-[10px] font-bold text-white grid place-items-center">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>

          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-card-hover">
              <span className="h-8 w-8 rounded-full bg-gradient-to-br from-accent to-violet-500 grid place-items-center text-xs font-bold text-white">
                {initials(user.name)}
              </span>
              <span className="hidden sm:block text-left leading-tight">
                <span className="block text-[13px] font-medium">{user.name}</span>
                <span className="block text-[10px] text-muted">{ROLE_LABEL[user.role as keyof typeof ROLE_LABEL] ?? user.role}</span>
              </span>
              <ChevronDown size={14} className="text-muted" />
            </button>
            {menu ? (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 card p-1.5 z-20 shadow-2xl">
                  <Link href="/account" onClick={() => setMenu(false)} className="block rounded-md px-3 py-2 text-sm text-muted hover:text-text hover:bg-card-hover">
                    My account
                  </Link>
                  <Link href="/settings" onClick={() => setMenu(false)} className="block rounded-md px-3 py-2 text-sm text-muted hover:text-text hover:bg-card-hover">
                    Shop settings
                  </Link>
                  {user.role === "OWNER" || user.role === "SUPERADMIN" ? (
                    <Link href="/billing" onClick={() => setMenu(false)} className="block rounded-md px-3 py-2 text-sm text-muted hover:text-text hover:bg-card-hover">
                      Billing &amp; plan
                    </Link>
                  ) : null}
                  <form action={logout}>
                    <button className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted hover:text-text hover:bg-card-hover">
                      <LogOut size={14} /> Sign out
                    </button>
                  </form>
                </div>
              </>
            ) : null}
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-5 pb-24 lg:pb-8 max-w-[1600px] w-full mx-auto">{children}</main>

        {/* Mobile tab bar (from the phone mockup) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 h-16 bg-bg-elevated/95 backdrop-blur border-t border-border grid grid-cols-5 items-center px-2">
          {[
            { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
            { href: "/vehicles", label: "Vehicles", Icon: Car },
          ].map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={`flex flex-col items-center gap-1 text-[10px] ${tab(href) ? "text-accent" : "text-muted"}`}>
              <Icon size={20} />
              {label}
            </Link>
          ))}
          <Link href="/work-orders/new" className="flex justify-center -mt-6" aria-label="New work order">
            <span className="h-12 w-12 rounded-full bg-accent grid place-items-center text-white shadow-[0_10px_24px_-8px_var(--accent)]">
              <Plus size={24} />
            </span>
          </Link>
          <Link href="/schedule" className={`flex flex-col items-center gap-1 text-[10px] ${tab("/schedule") ? "text-accent" : "text-muted"}`}>
            <Calendar size={20} />
            Schedule
          </Link>
          <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-1 text-[10px] text-muted">
            <MoreHorizontal size={20} />
            More
          </button>
        </nav>
      </div>
    </div>
  );
}
