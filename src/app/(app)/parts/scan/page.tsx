import Link from "next/link";
import { ScanBarcode } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, Flash, PageHeader } from "@/components/ui";
import { scanAdjust } from "@/actions/parts";
import { fmtRelative } from "@/lib/format";
import { ScanForm } from "./scan-form";

export const metadata = { title: "Scan inventory" };

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ mode?: string; ok?: string; error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const mode = sp.mode === "pull" ? "pull" : "receive";
  const recent = await db.stockMovement.findMany({ where: { reference: "scanner" }, orderBy: { createdAt: "desc" }, take: 12, include: { part: true } });

  return (
    <div>
      <PageHeader title="Scan inventory" subtitle="Works with any USB / Bluetooth barcode scanner (they type the SKU and press Enter). Or type a SKU by hand." crumbs={[{ label: "Parts & Inventory", href: "/parts" }, { label: "Scan" }]} />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex gap-1.5 mb-4">
            <Link href="/parts/scan?mode=receive" className={`rounded-full px-3 py-1 text-xs font-medium border ${mode === "receive" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "border-border text-muted"}`}>Receive (+)</Link>
            <Link href="/parts/scan?mode=pull" className={`rounded-full px-3 py-1 text-xs font-medium border ${mode === "pull" ? "bg-red-500/20 border-red-500/50 text-red-300" : "border-border text-muted"}`}>Pull (−)</Link>
          </div>
          <ScanForm action={scanAdjust} mode={mode} />
          <p className="text-xs text-faint mt-4 flex items-start gap-2"><ScanBarcode size={14} className="mt-0.5 shrink-0" /> Keep this page open at the parts counter. Each scan is logged as a stock movement with reference “scanner”. Live feeds from suppliers and production machines are configured under Settings → Integrations.</p>
        </Card>
        <Card title="Recent scans" padded={false}>
          <ul className="divide-y divide-border">
            {recent.map((m) => (
              <li key={m.id} className="px-5 py-2.5 flex items-center justify-between text-sm">
                <span><Link href={`/parts/${m.partId}`} className="hover:text-accent">{m.part.name}</Link> <span className="text-xs text-faint font-mono">{m.part.sku}</span></span>
                <span className="flex items-center gap-3"><span className={`font-semibold tabular-nums ${m.delta > 0 ? "text-emerald-400" : "text-red-400"}`}>{m.delta > 0 ? "+" : ""}{m.delta}</span><span className="text-xs text-faint">{fmtRelative(m.createdAt)}</span></span>
              </li>
            ))}
            {!recent.length ? <li className="px-5 py-8 text-sm text-muted text-center">No scans yet.</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
