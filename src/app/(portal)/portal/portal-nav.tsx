"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PortalNav({ unreadMessages, unreadNotifications }: { unreadMessages: number; unreadNotifications: number }) {
  const p = usePathname();
  const items = [
    { href: "/portal", label: "Overview" },
    { href: "/portal/messages", label: "Messages", badge: unreadMessages },
    { href: "/portal/notifications", label: "Updates", badge: unreadNotifications },
    { href: "/portal/book", label: "Book service" },
  ];
  return (
    <nav className="hidden md:flex items-center gap-1 ml-6">
      {items.map((i) => {
        const active = i.href === "/portal" ? p === "/portal" || p.startsWith("/portal/service") || p.startsWith("/portal/vehicles") || p.startsWith("/portal/invoices") : p.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={`relative rounded-lg px-3 py-1.5 text-sm ${active ? "bg-accent text-white" : "text-muted hover:text-text hover:bg-card-hover"}`}>
            {i.label}
            {i.badge ? <span className="ml-1.5 rounded-full bg-red-500 text-white text-[10px] px-1.5 py-0.5">{i.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
