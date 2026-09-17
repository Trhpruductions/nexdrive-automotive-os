import { Search } from "lucide-react";

/** GET form filter bar used by list pages — keeps the URL shareable. */
export function ListFilters({
  action,
  q,
  placeholder = "Search…",
  children,
  hidden,
}: {
  action: string;
  q?: string;
  placeholder?: string;
  children?: React.ReactNode;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-center gap-2 mb-4">
      {hidden
        ? Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))
        : null}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input name="q" defaultValue={q ?? ""} placeholder={placeholder} className="input pl-9 py-2" />
      </div>
      {children}
      <button className="btn btn-secondary btn-sm">Filter</button>
    </form>
  );
}

export function Pagination({ page, pages, base }: { page: number; pages: number; base: string }) {
  if (pages <= 1) return null;
  const sep = base.includes("?") ? "&" : "?";
  return (
    <div className="flex items-center justify-between gap-3 mt-4 text-sm text-muted">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? <a className="btn btn-secondary btn-sm" href={`${base}${sep}page=${page - 1}`}>Previous</a> : null}
        {page < pages ? <a className="btn btn-secondary btn-sm" href={`${base}${sep}page=${page + 1}`}>Next</a> : null}
      </div>
    </div>
  );
}
