export const metadata = { title: { absolute: "Terms of service — NexDrive Automotive OS" } };

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 prose-invert">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of service</h1>
      <p className="text-sm text-muted mt-2">Last updated September 2026</p>
      <div className="mt-8 space-y-6 text-sm text-muted leading-relaxed">
        <p>These terms govern use of NexDrive Automotive OS (&quot;the Service&quot;) provided by NexDrive Productions (&quot;we&quot;). By creating a shop account you agree to them on behalf of your business.</p>
        <h2 className="text-text font-semibold">Accounts and data</h2>
        <p>Each shop is a separate account. You own the data you enter — customers, vehicles, work orders, invoices, photos and feeds — and can export it through the API at any time. We process it only to provide the Service. Staff logins are for your employees; you are responsible for what they do with them.</p>
        <h2 className="text-text font-semibold">Trials and billing</h2>
        <p>Trials last 14 days with every module enabled and require no payment method. Paid plans are billed per shop per month and can be changed or cancelled at any time; cancellation takes effect at the end of the billing period. Suspended or cancelled shops cannot sign in, but their data is retained for 90 days.</p>
        <h2 className="text-text font-semibold">Acceptable use</h2>
        <p>Do not use the Service to send unsolicited messages, store data you have no right to store, attack other systems, or reverse-engineer the platform. API keys and webhook secrets are confidential to your shop.</p>
        <h2 className="text-text font-semibold">Availability and liability</h2>
        <p>We work hard to keep the Service available and back up data regularly, but it is provided &quot;as is&quot;. To the extent permitted by law our liability is limited to the fees you paid in the previous three months. Nothing here limits liability that cannot be limited by law.</p>
        <h2 className="text-text font-semibold">Changes</h2>
        <p>We may update these terms; material changes will be announced inside the Service at least 14 days in advance.</p>
        <p>Questions: <a href="/contact" className="text-accent">contact NexDrive Productions</a>.</p>
      </div>
    </div>
  );
}
