"use client";

import { useEffect, useRef } from "react";

export function ScanForm({ action, mode }: { action: (formData: FormData) => Promise<void>; mode: "receive" | "pull" }) {
  const ref = useRef<HTMLInputElement>(null);
  // keep focus on the SKU field so a hardware scanner always lands here
  useEffect(() => {
    ref.current?.focus();
    const onClick = () => setTimeout(() => ref.current?.focus(), 50);
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="mode" value={mode} />
      <label className="block">
        <span className="label">Scan or type SKU</span>
        <input ref={ref} name="sku" autoComplete="off" autoFocus required className="input text-lg font-mono uppercase py-3" placeholder="BRK-PAD-F150" />
      </label>
      <label className="block">
        <span className="label">Quantity per scan</span>
        <input name="delta" type="number" min="1" defaultValue={1} className="input" />
      </label>
      <button className={`btn w-full ${mode === "pull" ? "btn-danger" : "btn-success"}`}>{mode === "pull" ? "Pull from stock" : "Receive into stock"}</button>
    </form>
  );
}
