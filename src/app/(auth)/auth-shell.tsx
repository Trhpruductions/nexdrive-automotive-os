import Image from "next/image";
import Link from "next/link";

/** Compact centred layout for the forgot / reset password pages. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="app-canvas min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Link href="/"><Image src="/brand/logo-full.png" alt="NexDrive" width={180} height={128} priority style={{ height: "auto" }} /></Link></div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle ? <p className="text-sm text-muted mt-1 mb-5">{subtitle}</p> : <div className="mb-5" />}
        {children}
      </div>
    </main>
  );
}
