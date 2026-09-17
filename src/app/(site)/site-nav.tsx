"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#integrations", label: "Integrations" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export function SiteNav({ appHref }: { appHref: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <nav className="hidden md:flex items-center gap-1 ml-2">
        {LINKS.map((l) => <Link key={l.href} href={l.href} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-text hover:bg-white/5">{l.label}</Link>)}
      </nav>
      <div className="ml-auto hidden md:flex items-center gap-2">
        {appHref ? (
          <Link href={appHref} className="btn btn-primary">Open NexDrive</Link>
        ) : (
          <>
            <Link href="/login" className="btn btn-ghost">Sign in</Link>
            <Link href="/signup" className="btn btn-primary">Start free trial</Link>
          </>
        )}
      </div>
      <button className="ml-auto md:hidden btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} aria-label="Menu">{open ? <X size={20} /> : <Menu size={20} />}</button>
      {open ? (
        <div className="absolute top-16 inset-x-0 md:hidden border-b border-white/5 bg-[#05070c] px-4 py-3 space-y-1">
          {LINKS.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-muted hover:text-text hover:bg-white/5">{l.label}</Link>)}
          <div className="flex gap-2 pt-2">
            {appHref ? <Link href={appHref} className="btn btn-primary flex-1">Open NexDrive</Link> : <><Link href="/login" className="btn btn-secondary flex-1">Sign in</Link><Link href="/signup" className="btn btn-primary flex-1">Free trial</Link></>}
          </div>
        </div>
      ) : null}
    </>
  );
}
