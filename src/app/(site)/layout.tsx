import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/auth";
import { SiteNav } from "./site-nav";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  const appHref = user ? (user.role === "CUSTOMER" ? "/portal" : user.role === "SUPERADMIN" ? "/admin" : "/dashboard") : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#05070c] text-text">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#05070c]/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image src="/brand/mark.png" alt="" width={34} height={34} priority />
            <span className="leading-tight">
              <span className="block text-[13px] font-bold tracking-[0.18em]">NE<span className="text-accent">X</span>DRIVE</span>
              <span className="block text-[9px] tracking-[0.28em] text-muted uppercase">Automotive OS</span>
            </span>
          </Link>
          <SiteNav appHref={appHref} />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/5 mt-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-4 text-sm">
          <div className="md:col-span-2">
            <Image src="/brand/logo-full.png" alt="NexDrive Productions" width={150} height={107} />
            <p className="text-muted mt-3 max-w-sm">NexDrive Automotive OS — complete automotive business management software by NexDrive Productions. Technology built for the automotive industry.</p>
          </div>
          <div>
            <div className="card-title mb-2">Product</div>
            <ul className="space-y-1.5 text-muted">
              <li><Link href="/#features" className="hover:text-text">Features</Link></li>
              <li><Link href="/#integrations" className="hover:text-text">Integrations &amp; API</Link></li>
              <li><Link href="/pricing" className="hover:text-text">Pricing</Link></li>
              <li><Link href="/signup" className="hover:text-text">Start free trial</Link></li>
            </ul>
          </div>
          <div>
            <div className="card-title mb-2">Company</div>
            <ul className="space-y-1.5 text-muted">
              <li><Link href="/contact" className="hover:text-text">Contact / request a demo</Link></li>
              <li><Link href="/login" className="hover:text-text">Sign in</Link></li>
              <li><Link href="/terms" className="hover:text-text">Terms of service</Link></li>
              <li><Link href="/privacy" className="hover:text-text">Privacy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/5 py-4 text-center text-xs text-faint">© {new Date().getFullYear()} NexDrive Productions. All rights reserved.</div>
      </footer>
    </div>
  );
}
