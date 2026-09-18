import "server-only";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Branded HTML wrapper for outbound email: the shop's name/logo/accent, the
 * message body (URLs become buttons/links), and a quiet footer. Plain text is
 * always sent alongside, so mail clients that strip HTML still read fine.
 */
export function renderEmailHtml(opts: { shopName: string; logoUrl?: string | null; accent?: string | null; address?: string | null; phone?: string | null; subject: string; body: string; ctaLabel?: string }) {
  const accent = /^#[0-9a-f]{6}$/i.test(opts.accent ?? "") ? (opts.accent as string) : "#2f7cf6";
  const urlRe = /(https?:\/\/[^\s]+)/g;
  const urls = opts.body.match(urlRe) ?? [];
  const primary = urls[0];
  const paragraphs = opts.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#1f2937;">${esc(p).replace(/\n/g, "<br>").replace(urlRe, (u) => `<a href="${esc(u)}" style="color:${accent};word-break:break-all;">${esc(u)}</a>`)}</p>`)
    .join("");
  const cta = primary ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 18px 0;"><tr><td style="border-radius:8px;background:${accent};"><a href="${esc(primary)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(opts.ctaLabel ?? "Open")}</a></td></tr></table>` : "";
  const logo = opts.logoUrl && /^https?:\/\//.test(opts.logoUrl) ? `<img src="${esc(opts.logoUrl)}" alt="" width="44" height="44" style="border-radius:10px;vertical-align:middle;margin-right:10px;">` : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;">
<tr><td style="padding:20px 28px;border-bottom:4px solid ${accent};">${logo}<span style="font-size:18px;font-weight:700;color:#111827;vertical-align:middle;">${esc(opts.shopName)}</span></td></tr>
<tr><td style="padding:26px 28px 8px 28px;"><h1 style="margin:0 0 14px 0;font-size:20px;color:#111827;">${esc(opts.subject)}</h1>${paragraphs}${cta}</td></tr>
<tr><td style="padding:14px 28px 22px 28px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">${esc(opts.shopName)}${opts.address ? ` · ${esc(opts.address)}` : ""}${opts.phone ? ` · ${esc(opts.phone)}` : ""}<br><span style="color:#9ca3af;">Sent with NexDrive Automotive OS</span></td></tr>
</table></td></tr></table></body></html>`;
}
