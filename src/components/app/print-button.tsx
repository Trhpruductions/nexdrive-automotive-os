"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn btn-primary">
      <Printer size={15} /> Print / Save as PDF
    </button>
  );
}
