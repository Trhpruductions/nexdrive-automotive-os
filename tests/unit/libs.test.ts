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

describe("email html", () => {
  it("escapes content and turns the first URL into a button", async () => {
    const { renderEmailHtml } = await import("@/lib/email-html");
    const html = renderEmailHtml({ shopName: "Plex <Roswell>", accent: "#ff0000", subject: "Invoice INV-00001", body: "Hi Ana,\n\nView it here: https://x.example/pay/abc — thanks", ctaLabel: "View invoice" });
    expect(html).toContain("Plex &lt;Roswell&gt;");
    expect(html).toContain('href="https://x.example/pay/abc"');
    expect(html).toContain("View invoice");
    expect(html).toContain("background:#ff0000");
    expect(html).not.toContain("<Roswell>");
  });

  it("falls back to the default accent for a bad colour", async () => {
    const { renderEmailHtml } = await import("@/lib/email-html");
    expect(renderEmailHtml({ shopName: "S", accent: "red", subject: "x", body: "y" })).toContain("#2f7cf6");
  });
});

describe("twilio", () => {
  it("validates a signed webhook and normalises phone numbers", async () => {
    const { createHmac } = await import("node:crypto");
    const { phoneTail, validTwilioSignature } = await import("@/lib/twilio");
    const url = "https://shop.example/api/twilio/inbound";
    const params = { From: "+15755550101", Body: "Running late", To: "+15755550142" };
    const sig = createHmac("sha1", "tok").update(url + "Body" + params.Body + "From" + params.From + "To" + params.To).digest("base64");
    expect(validTwilioSignature(url, params, sig, "tok")).toBe(true);
    expect(validTwilioSignature(url, { ...params, Body: "changed" }, sig, "tok")).toBe(false);
    expect(validTwilioSignature(url, params, null, "tok")).toBe(false);
    expect(phoneTail("+1 (575) 555-0101")).toBe("5755550101");
    expect(phoneTail("575.555.0101")).toBe("5755550101");
  });
});

describe("business types", () => {
  it("every type has a complete vocabulary, checklist and services", async () => {
    const { VERTICALS, termsFor } = await import("@/lib/verticals");
    expect(VERTICALS.length).toBeGreaterThanOrEqual(8);
    for (const v of VERTICALS) {
      expect(v.terms.asset).toBeTruthy();
      expect(v.terms.assets).toBeTruthy();
      expect(v.terms.serial).toBeTruthy();
      expect(v.inspection.length).toBeGreaterThan(0);
      expect(v.cannedServices.length).toBeGreaterThan(0);
    }
    expect(termsFor("nope").asset).toBe("Vehicle"); // unknown → automotive
    expect(termsFor("marine").serial).toContain("Hull");
    expect(termsFor("electronics").odometer).toBeNull();
  });

  it("applies custom word overrides without touching the rest", async () => {
    const { termsFor } = await import("@/lib/verticals");
    const t = termsFor("automotive", { asset: "Rig", assets: "Rigs", plate: null });
    expect(t.asset).toBe("Rig");
    expect(t.plate).toBeNull();
    expect(t.serial).toBe("VIN");
  });
});

describe("production shifts", () => {
  it("assigns a moment to the right shift, including overnight shifts", async () => {
    const { shiftAt } = await import("@/lib/production");
    const shifts = [{ name: "1st", start: "06:00", end: "14:00" }, { name: "2nd", start: "14:00", end: "22:00" }, { name: "3rd", start: "22:00", end: "06:00" }];
    const at = (h: number, m = 0) => new Date(2026, 8, 17, h, m);
    expect(shiftAt(shifts, at(6))).toBe("1st");
    expect(shiftAt(shifts, at(13, 59))).toBe("1st");
    expect(shiftAt(shifts, at(14))).toBe("2nd");
    expect(shiftAt(shifts, at(23))).toBe("3rd");
    expect(shiftAt(shifts, at(2))).toBe("3rd");
    expect(shiftAt(shifts.slice(0, 2), at(2))).toBeNull();
  });
});
