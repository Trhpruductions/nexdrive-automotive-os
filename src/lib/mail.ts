import "server-only";
import nodemailer from "nodemailer";

/**
 * Outbound email. Uses Resend when RESEND_API_KEY is set, otherwise SMTP when
 * SMTP_HOST is set. With neither configured `mailConfigured()` is false and
 * callers fall back (notifications stay queued, reset links are logged).
 */
export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
}

export function smsConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

export async function sendEmail(opts: { to: string; subject: string; text: string; html?: string; from?: string }): Promise<boolean> {
  const from = opts.from ?? process.env.EMAIL_FROM ?? "NexDrive <no-reply@example.com>";
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: opts.to, subject: opts.subject, text: opts.text, ...(opts.html ? { html: opts.html } : {}) }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  if (process.env.SMTP_HOST) {
    try {
      const port = Number(process.env.SMTP_PORT ?? 587);
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE === "1" || port === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
      });
      await transport.sendMail({ from, to: opts.to, subject: opts.subject, text: opts.text, html: opts.html });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!smsConfigured()) return false;
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: process.env.TWILIO_FROM!, To: to, Body: body }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
