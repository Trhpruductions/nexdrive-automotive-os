import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { money } from "@/lib/format";
import { LabelSheet } from "./label-sheet";

export const metadata = { title: "Part labels" };

export default async function PartLabelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copies?: string }> }) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const [p, s] = await Promise.all([db.part.findUnique({ where: { id } }), getSettings()]);
  if (!p) notFound();
  const copies = Math.min(30, Math.max(1, Number(sp.copies) || 3));
  return (
    <div>
      <div className="no-print flex items-center justify-between mb-4">
        <Link href={`/parts/${p.id}`} className="text-sm text-muted hover:text-text inline-flex items-center gap-1"><ArrowLeft size={14} /> Back to part</Link>
        <form className="flex items-center gap-2 text-sm">
          <label htmlFor="copies" className="text-muted">Copies</label>
          <input id="copies" name="copies" type="number" min={1} max={30} defaultValue={copies} className="input w-20 py-1.5" />
          <button className="btn btn-secondary btn-sm">Update</button>
        </form>
      </div>
      <div className="print-sheet card p-4 bg-white">
        <LabelSheet sku={p.sku} name={p.name} location={p.location} price={money(p.price)} copies={copies} shopName={s.name} />
      </div>
    </div>
  );
}
