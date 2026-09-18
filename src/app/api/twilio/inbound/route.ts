import { NextResponse, type NextRequest } from "next/server";
import { rawDb } from "@/lib/db";
import { phoneTail, validTwilioSignature } from "@/lib/twilio";

export const runtime = "nodejs";

const twiml = (msg?: string) => new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Message>` : ""}</Response>`, { headers: { "Content-Type": "text/xml" } });

/**
 * Two-way SMS. Point the Twilio number's "A message comes in" webhook here.
 * The shop is found by the number texted (Settings → Business → SMS number),
 * the customer by their phone; the text lands in Messages for staff to answer.
 */
export async function POST(req: NextRequest) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return NextResponse.json({ error: "Twilio is not configured" }, { status: 404 });
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);
  const url = process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, "")}/api/twilio/inbound` : req.url;
  if (!validTwilioSignature(url, params, req.headers.get("x-twilio-signature"), token)) return NextResponse.json({ error: "Bad signature" }, { status: 403 });

  const from = params.From ?? "";
  const to = params.To ?? "";
  const body = (params.Body ?? "").trim();
  if (!from || !body) return twiml();

  // which shop: the number texted, else the single-shop fallback (TWILIO_FROM)
  const settings = await rawDb.shopSettings.findFirst({ where: { OR: [{ smsNumber: to }, ...(process.env.TWILIO_FROM === to ? [{ shopId: { not: "" } }] : [])] }, orderBy: { smsNumber: "desc" } });
  if (!settings) return twiml();
  const shopId = settings.shopId;

  // customer by phone digits (loose match on the last 10)
  const tail = phoneTail(from);
  const candidates = await rawDb.customer.findMany({ where: { shopId, phone: { not: null } }, select: { id: true, phone: true, firstName: true, lastName: true } });
  const customer = candidates.find((c) => phoneTail(c.phone ?? "") === tail);

  if (/^(stop|unsubscribe|cancel|end|quit)$/i.test(body)) {
    if (customer) {
      const cur = await rawDb.customer.findUnique({ where: { id: customer.id }, select: { notes: true } });
      await rawDb.customer.update({ where: { id: customer.id }, data: { notes: `${cur?.notes ?? ""}\n[SMS opt-out ${new Date().toISOString().slice(0, 10)}]`.trim() } });
    }
    return twiml(); // Twilio handles the STOP confirmation itself
  }

  if (!customer) {
    // unknown number: create a lead-style customer so the message isn't lost
    const created = await rawDb.customer.create({ data: { shopId, firstName: "Text from", lastName: from, phone: from, notes: "Created from an inbound text message" } });
    await rawDb.message.create({ data: { shopId, customerId: created.id, direction: "INBOUND", authorName: from, body } });
  } else {
    await rawDb.message.create({ data: { shopId, customerId: customer.id, direction: "INBOUND", authorName: `${customer.firstName} ${customer.lastName}`, body } });
  }
  return twiml();
}
