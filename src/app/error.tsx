"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

/** Route-level error boundary: keeps the shell usable and offers a retry. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="min-h-[60vh] grid place-items-center p-6">
      <div className="card p-8 max-w-md text-center">
        <p className="text-[11px] tracking-[0.3em] text-red-400 font-semibold">SOMETHING WENT WRONG</p>
        <h1 className="text-xl font-semibold mt-1">This page hit an error</h1>
        <p className="text-sm text-muted mt-2">Nothing was lost. Try again, or head back to the dashboard.{error.digest ? <span className="block text-[11px] text-faint mt-2 font-mono">ref {error.digest}</span> : null}</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={reset} className="btn btn-primary"><RotateCcw size={15} /> Try again</button>
          <Link href="/dashboard" className="btn btn-secondary">Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
