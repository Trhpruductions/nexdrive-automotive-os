import { CreditCard, Save } from "lucide-react";
import { headers } from "next/headers";
import { Badge, Card, Field } from "@/components/ui";
import { CopyField } from "./copy-field";
import { rawDb } from "@/lib/db";
import { savePayments } from "@/actions/settings";

/** Settings → Payments: the shop's own Stripe keys for card payments in the portal. */
export async function PaymentsTab({ shopId }: { shopId: string }) {
  const s = await rawDb.shopSettings.findUnique({ where: { shopId }, select: { stripeSecretKey: true, stripeWebhookSecret: true } });
  const h = await headers();
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const configured = Boolean(s?.stripeSecretKey && s?.stripeWebhookSecret);
  const mask = (k: string | null | undefined) => (k ? `${k.slice(0, 8)}…${k.slice(-4)}` : "");
  const live = s?.stripeSecretKey?.startsWith("sk_live_");

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
      <Card title="Card payments (Stripe)" action={configured ? <Badge tone={live ? "green" : "amber"}>{live ? "Live" : "Test mode"}</Badge> : <Badge tone="slate">Not set up</Badge>}>
        <p className="text-sm text-muted mb-4">Customers pay their invoice balance by card from the portal. Money goes straight to your Stripe account; NexDrive records the payment automatically.</p>
        <form action={savePayments} className="space-y-4 max-w-xl">
          <Field label="Stripe secret key" hint={s?.stripeSecretKey ? `Saved: ${mask(s.stripeSecretKey)} — leave blank to keep` : "Developers → API keys → Secret key (sk_live_… or sk_test_…)"}>
            <input name="stripeSecretKey" type="password" autoComplete="off" className="input font-mono" placeholder={s?.stripeSecretKey ? "••••••••" : "sk_live_…"} />
          </Field>
          <Field label="Webhook signing secret" hint={s?.stripeWebhookSecret ? `Saved: ${mask(s.stripeWebhookSecret)} — leave blank to keep` : "Developers → Webhooks → your endpoint → Signing secret (whsec_…)"}>
            <input name="stripeWebhookSecret" type="password" autoComplete="off" className="input font-mono" placeholder={s?.stripeWebhookSecret ? "••••••••" : "whsec_…"} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary"><Save size={15} /> Save & test</button>
            {configured ? <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="remove" value="1" /> Remove keys (turns card payments off)</label> : null}
          </div>
        </form>
      </Card>
      <Card title="Set-up steps">
        <ol className="text-sm text-muted space-y-3 list-decimal pl-4">
          <li>Create a free account at stripe.com and copy the <span className="text-text">secret key</span> from Developers → API keys.</li>
          <li>Under Developers → Webhooks add an endpoint with this URL and the event <span className="font-mono text-text">checkout.session.completed</span>:
            <CopyField value={`${base}/api/stripe/webhook/${shopId}`} />
          </li>
          <li>Paste the endpoint&apos;s <span className="text-text">signing secret</span> here and save. Use test keys first — Stripe&apos;s test card is 4242 4242 4242 4242.</li>
        </ol>
        <p className="text-xs text-faint mt-4 flex items-start gap-2"><CreditCard size={14} className="mt-0.5 shrink-0" /> Keys are stored on the server only and never shown again in full.</p>
      </Card>
    </div>
  );
}
