import Link from "next/link";
import { Download, Receipt } from "lucide-react";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, EmptyState, Flash, KpiCard, PageHeader } from "@/components/ui";
import { ListFilters, Pagination } from "@/components/app/search-bar";
import { INVOICE_STATUS } from "@/lib/constants";
import { fmtDate, invNumber, money, vehicleName, woNumber } from "@/lib/format";
import { AlertCircle, CircleDollarSign, Clock } from "lucide-react";
import type { InvoiceStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Invoices" };
const PAGE = 25;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string; ok?: string; error?: string }> }) {
  await requireStaff(BILLING_ROLES);
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status ?? "all";
  const num = Number(q.replace(/^inv-?/i, ""));
  const where = {
    ...(status === "open" ? { status: { in: ["SENT", "PARTIAL"] as InvoiceStatus[] } } : status !== "all" && status in INVOICE_STATUS ? { status: status as InvoiceStatus } : {}),
    ...(q ? { OR: [...(Number.isInteger(num) && num > 0 ? [{ number: num }] : []), { customer: { OR: [{ firstName: { contains: q, mode: "insensitive" as const } }, { lastName: { contains: q, mode: "insensitive" as const } }] } }, { workOrder: { vehicle: { OR: [{ make: { contains: q, mode: "insensitive" as const } }, { model: { contains: q, mode: "insensitive" as const } }, { licensePlate: { contains: q, mode: "insensitive" as const } }] } } }] } : {}),
  };
  const [total, rows, open, overdue, month] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({ where, orderBy: { issuedAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { customer: true, workOrder: { include: { vehicle: true } }, shipment: { select: { number: true } } } }),
    db.invoice.findMany({ where: { status: { in: ["SENT", "PARTIAL"] } }, select: { total: true, amountPaid: true, dueAt: true } }),
    db.invoice.count({ where: { status: { in: ["SENT", "PARTIAL"] }, dueAt: { lt: new Date() } } }),
    db.invoice.aggregate({ _sum: { total: true }, where: { status: { not: "VOID" }, issuedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
  ]);
  const outstanding = open.reduce((s, i) => s + Number(i.total) - Number(i.amountPaid), 0);

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Billing, taxes and receipts. Invoices are created from completed work orders." actions={<a href="/api/export/invoices" className="btn btn-secondary" download><Download size={16} /> Export CSV</a>} />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <KpiCard label="Outstanding" value={money(outstanding)} hint={`${open.length} open invoice${open.length === 1 ? "" : "s"}`} icon={Clock} tone="amber" href="/invoices?status=open" />
        <KpiCard label="Overdue" value={overdue} hint="Past due date" icon={AlertCircle} tone={overdue ? "red" : "slate"} href="/invoices?status=open" />
        <KpiCard label="Invoiced this month" value={money(month._sum.total ?? 0)} icon={CircleDollarSign} tone="green" href="/reports" />
      </div>
      <div className="flex gap-1.5 pb-3 overflow-x-auto">
        {[{ key: "all", label: "All" }, { key: "open", label: "Open" }, ...Object.entries(INVOICE_STATUS).map(([k, v]) => ({ key: k, label: v.label }))].map((t) => (
          <Link key={t.key} href={`/invoices?status=${t.key}`} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border ${status === t.key ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-text"}`}>{t.label}</Link>
        ))}
      </div>
      <ListFilters action="/invoices" q={q} placeholder="Search invoice #, customer, vehicle…" hidden={{ status }} />
      <Card padded={false}>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Vehicle</th><th>Status</th><th>Issued</th><th>Due</th><th className="text-right">Total</th><th className="text-right">Balance</th></tr></thead>
              <tbody>
                {rows.map((i) => {
                  const bal = Number(i.total) - Number(i.amountPaid);
                  const late = (i.status === "SENT" || i.status === "PARTIAL") && i.dueAt && i.dueAt < new Date();
                  return (
                    <tr key={i.id} className="row-link">
                      <td><Link href={`/invoices/${i.id}`} className="font-semibold hover:text-accent">{invNumber(i.number)}</Link><div className="text-xs text-muted">{i.workOrder ? woNumber(i.workOrder.number) : i.shipment ? `SH-${String(i.shipment.number).padStart(5, "0")}` : ""}</div></td>
                      <td><Link href={`/customers/${i.customerId}`} className="hover:text-accent">{i.customer.firstName} {i.customer.lastName}</Link></td>
                      <td className="text-muted text-xs">{i.workOrder ? vehicleName(i.workOrder.vehicle) : "Goods shipment"}</td>
                      <td><Badge tone={INVOICE_STATUS[i.status].tone}>{INVOICE_STATUS[i.status].label}</Badge></td>
                      <td className="text-xs text-muted">{fmtDate(i.issuedAt)}</td>
                      <td className={`text-xs ${late ? "text-red-400 font-semibold" : "text-muted"}`}>{fmtDate(i.dueAt)}</td>
                      <td className="text-right tabular-nums">{money(i.total)}</td>
                      <td className={`text-right tabular-nums font-medium ${bal > 0 && i.status !== "VOID" ? "text-amber-400" : ""}`}>{i.status === "VOID" ? "—" : money(bal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Receipt} title="No invoices" hint="Complete a work order and click “Create invoice”." />
        )}
      </Card>
      <Pagination page={page} pages={Math.ceil(total / PAGE)} base={`/invoices?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
    </div>
  );
}
