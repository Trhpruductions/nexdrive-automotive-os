import Link from "next/link";
import type { ReactNode } from "react";

/** Tiny markdown renderer for assistant replies: headings, bullets, bold, code, links. */
export function Markdown({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  let ordered = false;
  const flush = () => {
    if (!list.length) return;
    out.push(ordered ? <ol key={out.length} className="list-decimal pl-5 space-y-0.5">{list}</ol> : <ul key={out.length} className="list-disc pl-5 space-y-0.5">{list}</ul>);
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || num) {
      const isOrdered = Boolean(num);
      if (list.length && ordered !== isOrdered) flush();
      ordered = isOrdered;
      list.push(<li key={list.length}>{inline((bullet ?? num)![1])}</li>);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) out.push(<div key={out.length} className={`font-semibold ${h[1].length === 1 ? "text-base" : "text-sm"} mt-1`}>{inline(h[2])}</div>);
    else out.push(<p key={out.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-2 leading-relaxed">{out}</div>;
}

function inline(s: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) parts.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) parts.push(<code key={k++} className="rounded bg-card-hover px-1 py-0.5 text-[12px] font-mono">{t.slice(1, -1)}</code>);
    else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)!;
      const href = lm[2];
      parts.push(href.startsWith("/") ? <Link key={k++} href={href} className="text-accent hover:underline">{lm[1]}</Link> : <a key={k++} href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline">{lm[1]}</a>);
    }
    last = m.index + t.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
