import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Clock, MapPin, Phone } from "lucide-react";
import { rawDb, withShop } from "@/lib/db";
import { getSettings, accentVars, shopAddress } from "@/lib/settings";
import { BookingForm } from "./booking-form";

export const metadata = { title: "Book a service" };

/** Public online booking — linked from the shop's website / Google profile. */
export default async function BookPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ booked?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = await rawDb.shop.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!shop || !["ACTIVE", "TRIAL"].includes(shop.status)) notFound();
  return withShop(shop.id, async () => {
    const s = await getSettings();
    const services = await rawDb.cannedService.findMany({ where: { shopId: shop.id, active: true }, orderBy: { name: "asc" }, select: { name: true, description: true } });
    return (
      <main className="app-canvas min-h-screen py-8 px-4" style={accentVars(s.accentColor)}>
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-4 mb-8">
            {s.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logoUrl} alt="" className="h-14 w-14 rounded-xl object-cover bg-bg-elevated" />
            ) : (
              <Image src="/brand/mark.png" alt="" width={56} height={56} />
            )}
            <div>
              <h1 className="text-2xl font-semibold leading-tight">{s.name}</h1>
              <p className="text-sm text-muted">{s.tagline}</p>
            </div>
          </div>

          {sp.booked ? (
            <div className="card p-8 text-center">
              <CalendarCheck size={40} className="mx-auto text-emerald-400" />
              <h2 className="text-xl font-semibold mt-4">You&apos;re booked for {sp.booked}</h2>
              <p className="text-muted mt-2">{s.name} will confirm shortly{s.phone ? ` — or call ${s.phone} if anything changes` : ""}.</p>
              <Link href={`/book/${slug}`} className="btn btn-secondary mt-6">Book another</Link>
            </div>
          ) : !s.onlineBooking ? (
            <div className="card p-8 text-center">
              <h2 className="text-xl font-semibold">Online booking is off right now</h2>
              <p className="text-muted mt-2">{s.phone ? `Call ${s.phone} to schedule.` : "Please contact the shop to schedule."}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-[1fr_260px] gap-6">
              <BookingForm slug={slug} services={services} open={s.openTime} close={s.closeTime} terms={s.terms} />
              <aside className="space-y-4">
                <div className="card p-5 text-sm space-y-3">
                  <div className="flex items-start gap-2"><Clock size={16} className="text-accent mt-0.5 shrink-0" /><div><div className="font-medium">Hours</div><div className="text-muted">{fmtHour(s.openTime)} – {fmtHour(s.closeTime)}</div></div></div>
                  {s.phone ? <div className="flex items-start gap-2"><Phone size={16} className="text-accent mt-0.5 shrink-0" /><div><div className="font-medium">Phone</div><a href={`tel:${s.phone}`} className="text-muted hover:text-accent">{s.phone}</a></div></div> : null}
                  {shopAddress(s).length ? <div className="flex items-start gap-2"><MapPin size={16} className="text-accent mt-0.5 shrink-0" /><div><div className="font-medium">Address</div><div className="text-muted">{shopAddress(s).map((l) => <div key={l}>{l}</div>)}</div></div></div> : null}
                </div>
                {s.bookingNotes ? <div className="card p-5 text-sm text-muted whitespace-pre-line">{s.bookingNotes}</div> : null}
              </aside>
            </div>
          )}
          <p className="mt-10 text-center text-[11px] text-faint">Powered by NexDrive Automotive OS</p>
        </div>
      </main>
    );
  });
}

function fmtHour(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
