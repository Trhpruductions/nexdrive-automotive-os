import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { requireSuperadmin } from "@/lib/auth";
import { logout } from "@/actions/auth";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperadmin();
  return (
    <div className="app-canvas min-h-screen flex flex-col">
      <header className="border-b border-border bg-bg/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <Image src="/brand/mark.png" alt="" width={34} height={34} />
            <span className="leading-tight"><span className="block text-[13px] font-bold tracking-[0.18em]">NE<span className="text-accent">X</span>DRIVE</span><span className="block text-[9px] tracking-[0.28em] text-muted uppercase">Platform admin</span></span>
          </Link>
          <AdminNav />
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted hidden sm:block">{user.name}</span>
            <form action={logout}><button className="btn btn-ghost btn-sm"><LogOut size={14} /> Sign out</button></form>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
