import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Raw SQL bypasses the shop-scoped Prisma client, so every raw query that
 * touches a tenant table must filter by "shopId" itself. This guard failed for
 * the dashboard low-stock query once; keep it.
 */
function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

const TENANT_TABLES = ["Part", "Customer", "Vehicle", "WorkOrder", "Invoice", "Payment", "Appointment", "Inspection", "Notification", "Message", "Technician", "Supplier", "PurchaseOrder", "Machine", "ApiKey"];

describe("tenant isolation", () => {
  it("every raw query on a tenant table filters by shopId", () => {
    const files = walk(join(process.cwd(), "src")).filter((f) => !f.includes("generated"));
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const re = /\$(queryRaw|executeRaw)(Unsafe)?\s*(<[^>]*>)?\s*`([\s\S]*?)`/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const sql = m[4];
        const touchesTenant = TENANT_TABLES.some((t) => new RegExp(`"${t}"`).test(sql));
        if (touchesTenant && !/"shopId"\s*=/.test(sql)) offenders.push(`${f.replace(process.cwd(), "")}: ${sql.trim().slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
