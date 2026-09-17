import Link from "next/link";
import { CreditCard, Download } from "lucide-react";
import { endOfDay, startOfDay, startOfMonth, subDays } from "date-fns";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, EmptyState, KpiCard, PageHeader } from "@/components/ui";
import { Pagination } from "@/components/app/search-bar";
import { fmtDateTime, invNumber, money } from "@/lib/format";
import { CalendarDays, CircleDollarSign, Wallet } from "lucide-react";

export const metadata = { title: "Payments" };
const PAGE = 40;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ page?: string; method?: string }> }) {
  await requireStaff(BILLING_ROLES);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const now = new Date();
  const where = sp.method ? { method: sp.method as "CARD" } : {};
  const [total, rows, today, week, month, byMethod] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({ where, orderBy: { paidAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { invoice: { include: { customer: true } } } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: startOfDay(now), lte: endOfDay(now) } } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: subDays(startOfDay(now), 6) } } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: startOfMonth(now) } } }),
    db.payment.groupBy({ by: ["method"], _sum: { amount: true }, where: { paidAt: { gte: startOfMonth(now) } } }),
  ]);

  return (
    <div>
      <PageHeader title="Payments" subtitle="Every payment collected, newest first." actions={<a href="/api/export/payments" className="btn btn-secondary" download><Download size={16} /> Export CSV</a>} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <KpiCard label="Today" value={money(today._sum.amount ?? 0)} icon={CircleDollarSign} tone="green" />
        <KpiCard label="Last 7 days" value={money(week._sum.amount ?? 0)} icon={CalendarDays} />
        <KpiCard label="This month" value={money(month._sum.amount ?? 0)} hint={byMethod.map((m) => `${m.method.toLowerCase()} ${money(m._sum.amount ?? 0)}`).join(" · ")} icon={Wallet} tone="violet" />
      </div>
      <div className="flex gap-1.5 pb-3">
        {["", "CARD", "CASH", "CHECK", "ACH", "OTHER"].map((m) => (
          <Link key={m} href={`/payments${m ? `?method=${m}` : ""}`} className={`rounded-full px-3 py-1 text-xs font-medium border ${(sp.method ?? "") === m ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-text"}`}>{m ? m[0] + m.slice(1).toLowerCase() : "All"}</Link>
        ))}
      </div>
      <Card padded={false}>
        {rows.length ? (
          <table className="table">
            <thead><tr><th>Date</th><th>Customer</th><th>Invoice</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="row-link">
                  <td className="text-xs text-muted">{fmtDateTime(p.paidAt)}</td>
                  <td><Link href={`/customers/${p.invoice.customerId}`} className="hover:text-accent">{p.invoice.customer.firstName} {p.invoice.customer.lastName}</Link></td>
                  <td><Link href={`/invoices/${p.invoiceId}`} className="hover:text-accent">{invNumber(p.invoice.number)}</Link></td>
                  <td className="text-xs">{p.method[0] + p.method.slice(1).toLowerCase()}</td>
                  <td className="text-xs text-muted">{p.reference ?? "—"}</td>
                  <td className="text-right tabular-nums font-medium">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={CreditCard} title="No payments yet" />
        )}
      </Card>
      <Pagination page={page} pages={Math.ceil(total / PAGE)} base={`/payments${sp.method ? `?method=${sp.method}` : ""}`} />
    </div>
  );
}
