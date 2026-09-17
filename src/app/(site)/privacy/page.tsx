export const metadata = { title: { absolute: "Privacy — NexDrive Automotive OS" } };

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="text-sm text-muted mt-2">Last updated September 2026</p>
      <div className="mt-8 space-y-6 text-sm text-muted leading-relaxed">
        <h2 className="text-text font-semibold">What we store</h2>
        <p>Account details for your staff (name, email, hashed password), your shop&apos;s business data, and the customer records your shop enters. Customer portal logins are created by the shop and belong to the shop&apos;s account.</p>
        <h2 className="text-text font-semibold">How it is used</h2>
        <p>Only to run NexDrive for your shop: showing your data to your authorised users, sending the notifications you trigger (estimate links, ready-for-pickup, appointment confirmations) through the email/SMS providers you configure, and, if you enable NexDrive AI, sending the question and the minimum shop data needed to answer it to the AI provider you configured.</p>
        <h2 className="text-text font-semibold">Isolation and security</h2>
        <p>Every shop&apos;s data is isolated at the database layer; a query for one shop cannot return another shop&apos;s rows. Passwords are hashed with bcrypt, API keys are stored as hashes, sessions are signed and httpOnly, and webhook deliveries are signed with HMAC-SHA256.</p>
        <h2 className="text-text font-semibold">Retention and deletion</h2>
        <p>Data is kept while your shop account is active and for 90 days after cancellation, then deleted. You can request earlier deletion at any time.</p>
        <h2 className="text-text font-semibold">Contact</h2>
        <p>Privacy questions: <a href="/contact" className="text-accent">contact NexDrive Productions</a>.</p>
      </div>
    </div>
  );
}
