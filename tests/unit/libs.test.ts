import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

// stripe.ts pulls in the Prisma client for key lookups; the signature check is pure
vi.mock("@/lib/db", () => ({ rawDb: {} }));
import { autoMap, parseCsv } from "@/lib/csv";
import { fill } from "@/lib/templates";
import { laneLayout, vehicleName, woNumber } from "@/lib/format";
import { verifyStripeSignature } from "@/lib/stripe";
import { rateLimit, rateReset } from "@/lib/ratelimit";

describe("csv", () => {
  it("parses quotes, escaped quotes, CRLF and a BOM", () => {
    const { headers, rows } = parseCsv('﻿Name,Email,Notes\r\n"Smith, John",john@x.com,"He said ""hi"""\r\nJane,,\r\n\r\n');
    expect(headers).toEqual(["Name", "Email", "Notes"]);
    expect(rows).toEqual([
      { Name: "Smith, John", Email: "john@x.com", Notes: 'He said "hi"' },
      { Name: "Jane", Email: "", Notes: "" },
    ]);
  });

  it("auto-maps common column names", () => {
    const m = autoMap("customers", ["First Name", "LAST_NAME", "E-mail", "Cell", "Zip Code"]);
    expect(m).toMatchObject({ firstName: "First Name", lastName: "LAST_NAME", email: "E-mail", phone: "Cell", zip: "Zip Code" });
    expect(autoMap("parts", ["Part #", "Description", "Qty", "Vendor"])).toMatchObject({ sku: "Part #", name: "Description", quantityOnHand: "Qty", supplier: "Vendor" });
  });
});

describe("templates", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fill("Hi {customer}, your {vehicle} is ready at {shop}. {unknown}", { customer: "Ana", vehicle: "2020 Ford F-150", shop: "Plex" })).toBe("Hi Ana, your 2020 Ford F-150 is ready at Plex. {unknown}");
  });
});

describe("format", () => {
  it("formats numbers and names", () => {
    expect(woNumber(7)).toBe("WO-00007");
    expect(vehicleName({ year: 2021, make: "Ford", model: "F-150", trim: "Lariat" })).toBe("2021 Ford F-150 Lariat");
  });

  it("stacks overlapping appointments into lanes", () => {
    const d = (h: number, m = 0) => new Date(2026, 8, 17, h, m);
    const { placed, lanes } = laneLayout([
      { id: "a", scheduledStart: d(9), scheduledEnd: d(11) },
      { id: "b", scheduledStart: d(10), scheduledEnd: d(12) },
      { id: "c", scheduledStart: d(11), scheduledEnd: d(13) },
    ]);
    expect(lanes).toBe(2);
    expect(placed.map((p) => [p.item.id, p.lane])).toEqual([["a", 0], ["b", 1], ["c", 0]]);
  });
});

describe("stripe signature", () => {
  const secret = "whsec_test";
  const body = '{"id":"evt_1"}';
  const sign = (t: number) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

  it("accepts a fresh valid signature and rejects tampering", () => {
    const t = Math.floor(Date.now() / 1000);
    expect(verifyStripeSignature(body, sign(t), secret)).toBe(true);
    expect(verifyStripeSignature(body + " ", sign(t), secret)).toBe(false);
    expect(verifyStripeSignature(body, sign(t), "whsec_other")).toBe(false);
    expect(verifyStripeSignature(body, null, secret)).toBe(false);
  });

  it("rejects stale timestamps", () => {
    expect(verifyStripeSignature(body, sign(Math.floor(Date.now() / 1000) - 3600), secret)).toBe(false);
  });
});

describe("rate limit", () => {
  it("allows N hits per window then blocks", () => {
    rateReset("t:1");
    expect(rateLimit("t:1", 3, 60)).toBe(0);
    expect(rateLimit("t:1", 3, 60)).toBe(0);
    expect(rateLimit("t:1", 3, 60)).toBe(0);
    expect(rateLimit("t:1", 3, 60)).toBeGreaterThan(0);
    rateReset("t:1");
    expect(rateLimit("t:1", 3, 60)).toBe(0);
  });
});
