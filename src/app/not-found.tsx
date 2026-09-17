import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="app-canvas min-h-screen grid place-items-center p-6">
      <div className="card p-8 max-w-md text-center">
        <Image src="/brand/mark.png" alt="" width={56} height={56} className="mx-auto" />
        <p className="mt-4 text-[11px] tracking-[0.3em] text-accent font-semibold">404</p>
        <h1 className="text-xl font-semibold mt-1">That page isn&apos;t here</h1>
        <p className="text-sm text-muted mt-2">It may have been moved, deleted, or belongs to a different shop.</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Link href="/dashboard" className="btn btn-primary">Go to dashboard</Link>
          <Link href="/" className="btn btn-secondary">NexDrive home</Link>
        </div>
      </div>
    </main>
  );
}
