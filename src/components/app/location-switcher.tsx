"use client";

import { useTransition } from "react";
import { MapPin } from "lucide-react";
import { switchShop } from "@/actions/locations";

/** Header control for users who can work in more than one location. */
export function LocationSwitcher({ locations, activeShopId }: { locations: { shopId: string; name: string; role: string }[]; activeShopId: string }) {
  const [pending, start] = useTransition();
  if (locations.length < 2) return null;
  return (
    <label className={`hidden md:flex items-center gap-1.5 text-sm ${pending ? "opacity-60" : ""}`} title="Switch location">
      <MapPin size={15} className="text-accent" />
      <select value={activeShopId} onChange={(e) => start(() => switchShop(e.target.value))} className="select py-1.5 text-[13px] max-w-[220px]" aria-label="Location">
        {locations.map((l) => <option key={l.shopId} value={l.shopId}>{l.name}</option>)}
      </select>
    </label>
  );
}
