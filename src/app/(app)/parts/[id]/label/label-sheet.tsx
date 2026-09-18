"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Printer } from "lucide-react";

/** Printable bin labels with a Code 128 barcode of the SKU (scans on the Parts → Scan page). */
export function LabelSheet({ sku, name, location, price, copies, shopName }: { sku: string; name: string; location: string | null; price: string; copies: number; shopName: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelectorAll<SVGSVGElement>("svg.barcode").forEach((el) => {
      try {
        JsBarcode(el, sku, { format: "CODE128", displayValue: false, height: 44, width: 1.6, margin: 0 });
      } catch {
        /* unencodable SKU — the text still prints */
      }
    });
  }, [sku, copies]);
  return (
    <div>
      <div className="no-print flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-muted">{copies} label{copies === 1 ? "" : "s"} · 2⅝ × 1 in (Avery 5160 / 30-up). Set the printer to actual size.</p>
        <button onClick={() => window.print()} className="btn btn-primary"><Printer size={15} /> Print</button>
      </div>
      <div ref={ref} className="grid gap-x-[0.14in] gap-y-0 print:gap-y-0" style={{ gridTemplateColumns: "repeat(3, 2.625in)" }}>
        {Array.from({ length: copies }).map((_, i) => (
          <div key={i} className="h-[1in] w-[2.625in] px-[0.12in] py-[0.06in] flex flex-col justify-between overflow-hidden text-black bg-white border border-dashed border-gray-300 print:border-0">
            <div className="text-[10px] leading-tight font-semibold truncate">{name}</div>
            <svg className="barcode w-full" />
            <div className="flex justify-between text-[9px] leading-none font-mono">
              <span>{sku}</span>
              <span>{location ?? shopName}</span>
              <span>{price}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
