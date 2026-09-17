"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav() {
  const p = usePathname();
  const items = [
    { href: "/admin", label: "Shops", active: p === "/admin" || p.startsWith("/admin/shops") },
    { href: "/admin/leads", label: "Leads", active: p.startsWith("/admin/leads") },
  ];
  return (
    <nav className="flex items-center gap-1 ml-4">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={`rounded-lg px-3 py-1.5 text-sm ${i.active ? "bg-accent text-white" : "text-muted hover:text-text hover:bg-card-hover"}`}>{i.label}</Link>
      ))}
    </nav>
  );
}
