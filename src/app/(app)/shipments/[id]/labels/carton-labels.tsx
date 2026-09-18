"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Printer } from "lucide-react";

export type CartonLabel = {
  key: string;
  shopName: string;
  customer: string;
  customerPart: string | null;
  sku: string;
  name: string;
  rev: string | null;
  qty: number;
  carton: number;
  cartons: number;
  job: string | null;
  po: string | null;
  lots: string;
  shipment: string;
  date: string;
};

/** 4 × 3 in carton labels: customer part (barcoded), quantity, lot / heat, carton n of N. Set the printer to actual size. */
export function CartonLabels({ labels }: { labels: CartonLabel[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelectorAll<SVGSVGElement>("svg.barcode").forEach((el) => {
      try {
        JsBarcode(el, el.dataset.value ?? "", { format: "CODE128", displayValue: false, height: 40, width: 1.5, margin: 0 });
      } catch {
        /* unencodable part number — the text still prints */
      }
    });
  }, [labels]);
  return (
    <div>
      <div className="no-print flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-muted">{labels.length} label{labels.length === 1 ? "" : "s"} · 4 × 3 in. Set the printer to actual size; one label per page on a label printer, or 2-up on letter.</p>
        <button onClick={() => window.print()} className="btn btn-primary"><Printer size={15} /> Print</button>
      </div>
      <div ref={ref} className="grid gap-4 print:gap-0" style={{ gridTemplateColumns: "repeat(auto-fill, 4in)" }}>
        {labels.map((l) => (
          <div key={l.key} className="h-[3in] w-[4in] p-[0.15in] flex flex-col text-black bg-white border border-dashed border-gray-300 print:border-0 print:break-inside-avoid">
            <div className="flex justify-between text-[9px] uppercase tracking-wide"><span>{l.shopName}</span><span>{l.shipment} · {l.date}</span></div>
            <div className="text-[9px] mt-1">Ship to: <span className="font-semibold">{l.customer}</span>{l.po ? ` · PO ${l.po}` : ""}</div>
            <div className="mt-1 text-[22px] font-bold leading-none tracking-tight truncate">{l.customerPart ?? l.sku}</div>
            <div className="text-[10px] leading-tight truncate">{l.customerPart ? `${l.sku} · ` : ""}{l.name}{l.rev ? ` · rev ${l.rev}` : ""}</div>
            <svg className="barcode w-full mt-1" data-value={l.customerPart ?? l.sku} />
            <div className="mt-auto grid grid-cols-3 gap-2 text-[10px] leading-tight">
              <div><div className="text-gray-500">QTY</div><div className="text-[18px] font-bold leading-none">{l.qty.toLocaleString()}</div></div>
              <div><div className="text-gray-500">LOT / HEAT</div><div className="font-mono text-[10px] break-all">{l.lots || "—"}</div></div>
              <div className="text-right"><div className="text-gray-500">CARTON</div><div className="text-[18px] font-bold leading-none">{l.carton} / {l.cartons}</div>{l.job ? <div className="font-mono text-[9px]">{l.job}</div> : null}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
