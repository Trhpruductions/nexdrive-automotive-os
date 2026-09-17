import Link from "next/link";
import { ArrowUpRight, ChevronRight, type LucideIcon } from "lucide-react";
import { TONE_CLASS, TONE_TEXT, type Tone } from "@/lib/constants";

export function PageHeader({
  title,
  subtitle,
  actions,
  crumbs,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  crumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {crumbs?.length ? (
          <div className="flex items-center gap-1 text-xs text-muted mb-1.5">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {c.href ? <Link href={c.href} className="hover:text-text">{c.label}</Link> : <span className="text-text">{c.label}</span>}
                {i < crumbs.length - 1 ? <ChevronRight size={12} className="text-faint" /> : null}
              </span>
            ))}
          </div>
        ) : null}
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">{title}</h1>
        {subtitle ? <p className="text-sm text-muted mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
  padded = true,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="card-title">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className={padded ? `px-5 pb-5 ${title ? "" : "pt-5"}` : ""}>{children}</div>
    </section>
  );
}

export function ViewAll({ href, label = "View All" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-0.5">
      {label} <ArrowUpRight size={12} />
    </Link>
  );
}

export function Badge({ tone = "slate", children, className = "" }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap ${TONE_CLASS[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Dot({ tone = "slate" }: { tone?: Tone }) {
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${TONE_TEXT[tone].replace("text-", "bg-")}`} />;
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
  href,
  delta,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
  delta?: { value: number; label: string };
}) {
  const iconTone: Record<Tone, string> = {
    slate: "bg-slate-500/15 text-slate-300",
    blue: "bg-accent-soft text-accent",
    green: "bg-emerald-500/15 text-emerald-400",
    amber: "bg-amber-500/15 text-amber-400",
    orange: "bg-orange-500/15 text-orange-400",
    red: "bg-red-500/15 text-red-400",
    violet: "bg-violet-500/15 text-violet-400",
  };
  const body = (
    <div className="card card-hover p-4 sm:p-5 flex items-start justify-between gap-3 h-full transition-colors">
      <div className="min-w-0">
        <div className="card-title">{label}</div>
        <div className="mt-2 text-2xl sm:text-[28px] font-semibold tracking-tight leading-none">{value}</div>
        {delta ? (
          <div className={`mt-2 text-xs font-medium ${delta.value >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {delta.value >= 0 ? "+" : ""}
            {(delta.value * 100).toFixed(1)}% <span className="text-muted font-normal">{delta.label}</span>
          </div>
        ) : hint ? (
          <div className="mt-2 text-xs text-muted">{hint}</div>
        ) : null}
      </div>
      <div className={`h-11 w-11 shrink-0 rounded-xl grid place-items-center ${iconTone[tone]}`}>
        <Icon size={22} strokeWidth={1.8} />
      </div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

export function EmptyState({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto h-12 w-12 rounded-xl bg-card-hover grid place-items-center text-muted">
        <Icon size={22} />
      </div>
      <p className="mt-3 font-medium">{title}</p>
      {hint ? <p className="text-sm text-muted mt-1">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Field({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-faint mt-1">{hint}</span> : null}
    </label>
  );
}

export function Progress({ value, tone = "blue", className = "" }: { value: number; tone?: Tone; className?: string }) {
  const bar: Record<Tone, string> = {
    slate: "bg-slate-400",
    blue: "bg-accent",
    green: "bg-emerald-500",
    amber: "bg-amber-400",
    orange: "bg-orange-400",
    red: "bg-red-500",
    violet: "bg-violet-500",
  };
  return (
    <div className={`h-1.5 w-full rounded-full bg-border overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${bar[tone]}`} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

export function Avatar({ name, color, size = 32 }: { name: string; color?: string; size?: number }) {
  const init = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      className="inline-grid place-items-center rounded-full font-bold text-white shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36, background: color ?? "linear-gradient(135deg, var(--accent), #8b5cf6)" }}
    >
      {init}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
      {sub ? <div className="text-xs text-faint">{sub}</div> : null}
    </div>
  );
}

export function Flash({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  if (searchParams.ok) return <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">{searchParams.ok}</div>;
  if (searchParams.error) return <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{searchParams.error}</div>;
  return null;
}
