import { describe, expect, it } from "vitest";

/**
 * Smoke test against a running server (dev or production):
 *   NEXDRIVE_URL=http://127.0.0.1:4500 NEXDRIVE_API_KEY=nd_live_… npm run test:smoke
 * Skips itself when NEXDRIVE_URL is not set so `npm test` stays offline.
 */
const base = process.env.NEXDRIVE_URL?.replace(/\/$/, "");
const apiKey = process.env.NEXDRIVE_API_KEY;
const d = base ? describe : describe.skip;

d("http smoke", { timeout: 60_000 }, () => {
  it("serves the health check", async () => {
    const r = await fetch(`${base}/api/health`);
    expect(r.status).toBe(200);
    const j = (await r.json()) as { ok?: boolean; status?: string };
    expect(j.ok ?? j.status === "ok").toBeTruthy();
  });

  it("serves public pages without a session", async () => {
    for (const p of ["/", "/pricing", "/login", "/signup", "/forgot-password", "/book/plex-roswell"]) {
      const r = await fetch(`${base}${p}`, { redirect: "manual" });
      expect(r.status, p).toBe(200);
    }
  });

  it("redirects protected pages to the login screen", async () => {
    for (const p of ["/dashboard", "/settings", "/reports", "/portal"]) {
      const r = await fetch(`${base}${p}`, { redirect: "manual" });
      expect([302, 307, 308], p).toContain(r.status);
      expect(r.headers.get("location") ?? "").toContain("/login");
    }
  });

  it("rejects API calls without a key and exports without a session", async () => {
    expect((await fetch(`${base}/api/v1/customers`)).status).toBe(401);
    expect((await fetch(`${base}/api/export/customers`)).status).toBe(401);
    expect((await fetch(`${base}/api/stripe/webhook/nope`, { method: "POST", body: "{}" })).status).toBe(404);
  });

  (apiKey ? it : it.skip)("answers API v1 with plain JSON numbers", async () => {
    const r = await fetch(`${base}/api/v1/invoices?limit=1`, { headers: { Authorization: `Bearer ${apiKey}` } });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: { total: unknown }[] };
    if (j.data.length) expect(typeof j.data[0].total).toBe("number");
  });
});
