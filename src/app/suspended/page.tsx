import Image from "next/image";
import Link from "next/link";
import { logout } from "@/actions/auth";
import { getSession } from "@/lib/auth";
import { rawDb } from "@/lib/db";

export const metadata = { title: "Account suspended" };

export default async function SuspendedPage() {
  const user = await getSession();
  const owner = user?.role === "OWNER";
  const shop = user?.activeShopId ? await rawDb.shop.findUnique({ where: { id: user.activeShopId }, select: { status: true, trialEndsAt: true, plan: true } }) : null;
  const trialEnded = shop?.plan === "TRIAL" && shop.trialEndsAt && shop.trialEndsAt < new Date();
  return (
    <main className="app-canvas min-h-screen grid place-items-center p-6">
      <div className="card p-8 max-w-md text-center">
        <Image src="/brand/mark.png" alt="" width={56} height={56} className="mx-auto" />
        <h1 className="text-xl font-semibold mt-4">{trialEnded ? "Your free trial has ended" : "This shop's account is suspended"}</h1>
        <p className="text-sm text-muted mt-2">Your data is safe.{owner ? " Choose a plan to pick up right where you left off." : " Ask the shop owner to choose a plan, or contact NexDrive support."}</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          {owner ? <Link href="/billing" className="btn btn-primary">Choose a plan</Link> : null}
          <form action={logout}><button className="btn btn-secondary w-full">Sign out</button></form>
        </div>
      </div>
    </main>
  );
}
