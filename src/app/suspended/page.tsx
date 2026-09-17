import Image from "next/image";
import { logout } from "@/actions/auth";

export const metadata = { title: "Account suspended" };

export default function SuspendedPage() {
  return (
    <main className="app-canvas min-h-screen grid place-items-center p-6">
      <div className="card p-8 max-w-md text-center">
        <Image src="/brand/mark.png" alt="" width={56} height={56} className="mx-auto" />
        <h1 className="text-xl font-semibold mt-4">This shop&apos;s account is suspended</h1>
        <p className="text-sm text-muted mt-2">Your data is safe. Contact NexDrive support to reactivate the account, then sign in again.</p>
        <form action={logout} className="mt-6"><button className="btn btn-secondary">Sign out</button></form>
      </div>
    </main>
  );
}
