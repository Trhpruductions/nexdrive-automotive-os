// Work-order / invoice arithmetic. Everything is done in plain numbers rounded
// to cents at the end; Prisma Decimals are converted on the way in.

type Num = number | string | { toString(): string } | null | undefined;
const n = (v: Num) => (v == null ? 0 : Number(v.toString()));
export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export type LineLike = {
  kind: "LABOR" | "PART" | "FEE" | "DISCOUNT";
  quantity: Num;
  unitPrice: Num;
  hours?: Num;
  taxable: boolean;
  approved: boolean;
};

export function lineTotal(line: LineLike) {
  const qty = line.kind === "LABOR" ? n(line.hours ?? line.quantity) : n(line.quantity);
  const total = qty * n(line.unitPrice);
  return round2(line.kind === "DISCOUNT" ? -Math.abs(total) : total);
}

export type Totals = {
  labor: number;
  parts: number;
  fees: number;
  discount: number;
  subtotal: number;
  taxable: number;
  tax: number;
  total: number;
  declined: number;
};

/** Totals over approved lines; `declined` is the value of lines the customer declined. */
export function computeTotals(lines: LineLike[], taxRate: Num, opts: { taxExempt?: boolean } = {}): Totals {
  const t: Totals = { labor: 0, parts: 0, fees: 0, discount: 0, subtotal: 0, taxable: 0, tax: 0, total: 0, declined: 0 };
  for (const line of lines) {
    const amt = lineTotal(line);
    if (!line.approved) {
      t.declined += amt;
      continue;
    }
    if (line.kind === "LABOR") t.labor += amt;
    else if (line.kind === "PART") t.parts += amt;
    else if (line.kind === "FEE") t.fees += amt;
    else t.discount += amt;
    if (line.taxable && line.kind !== "DISCOUNT") t.taxable += amt;
  }
  t.subtotal = round2(t.labor + t.parts + t.fees + t.discount);
  // discounts reduce the taxable base proportionally
  const base = t.labor + t.parts + t.fees;
  const taxableAfterDiscount = base > 0 ? t.taxable * ((base + t.discount) / base) : 0;
  t.tax = opts.taxExempt ? 0 : round2(Math.max(0, taxableAfterDiscount) * n(taxRate));
  t.total = round2(t.subtotal + t.tax);
  t.declined = round2(t.declined);
  t.labor = round2(t.labor);
  t.parts = round2(t.parts);
  t.fees = round2(t.fees);
  t.discount = round2(t.discount);
  return t;
}
