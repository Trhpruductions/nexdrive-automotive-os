"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BarChart3, X } from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { NAV_ICON } from "./nav-icons";

export function Sidebar({
  nav,
  shopName,
  logoUrl,
  open,
  onClose,
}: {
  nav: NavItem[];
  shopName: string;
  logoUrl: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const groups: NavItem["group"][] = ["main", "comms", "admin"];

  return (
    <>
      {/* mobile backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[var(--sidebar-w)] flex flex-col bg-bg-elevated border-r border-border transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-16 flex items-center gap-3 px-4 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0" onClick={onClose}>
            <Image src="/brand/mark.png" alt="" width={34} height={34} className="shrink-0" />
            <div className="min-w-0 leading-tight">
              <div className="text-[13px] font-bold tracking-[0.18em]">
                NE<span className="text-accent">X</span>DRIVE
              </div>
              <div className="text-[9px] tracking-[0.28em] text-muted uppercase">Automotive OS</div>
            </div>
          </Link>
          <button className="ml-auto lg:hidden btn btn-ghost btn-sm" onClick={onClose} aria-label="Close menu">
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {groups.map((g, gi) => {
            const items = nav.filter((n) => n.group === g);
            if (!items.length) return null;
            return (
              <div key={g} className={gi > 0 ? "pt-3 mt-3 border-t border-border" : ""}>
                {items.map((item) => {
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")) || (item.href !== "/dashboard" && pathname === item.href);
                  const Icon = item.key === "reports" ? BarChart3 : NAV_ICON[item.key];
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
                        active ? "bg-accent text-white shadow-[0_6px_18px_-8px_var(--accent)]" : "text-muted hover:text-text hover:bg-card-hover"
                      }`}
                    >
                      <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-border flex items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-md object-cover bg-card" />
          ) : (
            <div className="h-8 w-8 rounded-md bg-accent-soft text-accent grid place-items-center text-xs font-bold">
              {shopName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate">{shopName}</div>
            <div className="text-[10px] text-faint">Powered by NexDrive</div>
          </div>
        </div>
      </aside>
    </>
  );
}
