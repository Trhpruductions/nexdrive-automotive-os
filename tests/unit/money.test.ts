import { describe, expect, it } from "vitest";
import { computeTotals, lineTotal, round2 } from "@/lib/money";

const line = (p: Partial<Parameters<typeof lineTotal>[0]>) => ({ kind: "PART" as const, quantity: 1, unitPrice: 0, taxable: true, approved: true, ...p });

describe("money", () => {
  it("rounds to cents without float drift", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
  });

  it("uses hours for labor and quantity for everything else", () => {
    expect(lineTotal(line({ kind: "LABOR", hours: 1.5, quantity: 1, unitPrice: 125 }))).toBe(187.5);
    expect(lineTotal(line({ kind: "PART", quantity: 4, unitPrice: 9.99 }))).toBe(39.96);
    expect(lineTotal(line({ kind: "DISCOUNT", quantity: 1, unitPrice: 20 }))).toBe(-20);
  });

  it("taxes only taxable approved lines and reduces the base by discounts", () => {
    const t = computeTotals(
      [
        line({ kind: "LABOR", hours: 2, quantity: 1, unitPrice: 100, taxable: false }),
        line({ kind: "PART", quantity: 2, unitPrice: 50, taxable: true }),
        line({ kind: "FEE", quantity: 1, unitPrice: 10, taxable: true }),
        line({ kind: "DISCOUNT", quantity: 1, unitPrice: 31, taxable: false }),
        line({ kind: "PART", quantity: 1, unitPrice: 999, approved: false }),
      ],
      0.07,
    );
    expect(t.labor).toBe(200);
    expect(t.parts).toBe(100);
    expect(t.fees).toBe(10);
    expect(t.discount).toBe(-31);
    expect(t.subtotal).toBe(279);
    expect(t.declined).toBe(999);
    // taxable 110 scaled by (310-31)/310 = 99 → 7% = 6.93
    expect(t.tax).toBe(6.93);
    expect(t.total).toBe(285.93);
  });

  it("charges no tax for tax-exempt customers", () => {
    const t = computeTotals([line({ quantity: 1, unitPrice: 100 })], 0.07, { taxExempt: true });
    expect(t.tax).toBe(0);
    expect(t.total).toBe(100);
  });

  it("accepts Prisma-style decimal strings", () => {
    const t = computeTotals([line({ quantity: "2", unitPrice: "12.50" })], "0.0825");
    expect(t.subtotal).toBe(25);
    expect(t.tax).toBe(2.06);
  });
});
