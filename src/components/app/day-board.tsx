"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveAppointment } from "@/actions/appointments";
import { vehicleName, customerName, laneLayout } from "@/lib/format";

type Appt = {
  id: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: string;
  serviceRequested: string;
  bay: { id: string; name: string } | null;
  vehicle: { year: number; make: string; model: string; trim?: string | null };
  customer: { firstName: string; lastName: string };
  technician: { name: string; color: string } | null;
};

const STATUS_BG: Record<string, string> = {
  SCHEDULED: "bg-slate-600/70 border-slate-400/40",
  CONFIRMED: "bg-accent/80 border-blue-300/40",
  CHECKED_IN: "bg-violet-600/80 border-violet-300/40",
  IN_PROGRESS: "bg-accent border-blue-200/50",
  COMPLETED: "bg-emerald-700/80 border-emerald-300/40",
};
const SNAP = 15; // minutes
const ROW_H = 60;
const LABEL_W = 64;
const NONE = "__none";

/**
 * Drag-and-drop bay board for the day view. Drag a block to another bay row
 * or along the time axis (snaps to 15 min); a click without movement opens it.
 */
export function DayBoard({ appointments, bays, open, close, dateKey }: { appointments: Appt[]; bays: { id: string; name: string }[]; open: string; close: string; dateKey: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x0: number; y0: number; dx: number; dy: number; moved: boolean } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const startMin = oh * 60 + om;
  const total = Math.max(60, ch * 60 + cm - startMin);
  const hours: number[] = [];
  for (let m = startMin; m <= startMin + total; m += 60) hours.push(m);
  const pos = (d: Date) => Math.min(1, Math.max(0, (d.getHours() * 60 + d.getMinutes() - startMin) / total));
  const rows = [...bays, { id: NONE, name: "Unassigned" }];

  // pointer tracking on the window while a block is held
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, dx: e.clientX - d.x0, dy: e.clientY - d.y0, moved: d.moved || Math.abs(e.clientX - d.x0) > 4 || Math.abs(e.clientY - d.y0) > 4 } : d));
    const up = (e: PointerEvent) => {
      const d = drag;
      setDrag(null);
      if (!d) return;
      const moved = d.moved || Math.abs(e.clientX - d.x0) > 4 || Math.abs(e.clientY - d.y0) > 4;
      if (!moved) return router.push(`/schedule/${d.id}`);
      const target = dropTarget(d.id, e.clientX, e.clientY);
      if (!target) return;
      const a = appointments.find((x) => x.id === d.id)!;
      const sameBay = (a.bay?.id ?? null) === target.bayId;
      if (sameBay && target.start.getTime() === a.scheduledStart.getTime()) return;
      setError(null);
      startTransition(async () => {
        let r = await moveAppointment(d.id, target.bayId, target.start.toISOString());
        if (r.conflict && window.confirm(`${r.conflict}.\n\nMove anyway (double-book)?`)) r = await moveAppointment(d.id, target.bayId, target.start.toISOString(), true);
        if (r.error) setError(r.error);
        else if (r.conflict) setError(null);
        router.refresh();
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id]);

  function dropTarget(id: string, clientX: number, clientY: number) {
    const board = boardRef.current;
    const track = trackRef.current;
    if (!board || !track) return null;
    const a = appointments.find((x) => x.id === id);
    if (!a) return null;
    const rowsTop = board.getBoundingClientRect().top + 20; // header strip height
    const rowIdx = Math.min(rows.length - 1, Math.max(0, Math.floor((clientY - rowsTop) / ROW_H)));
    const bayId = rows[rowIdx].id === NONE ? null : rows[rowIdx].id;
    // where the block's left edge lands, not the pointer: keep the grab offset
    const tr = track.getBoundingClientRect();
    const d = drag;
    const originalLeft = tr.left + pos(a.scheduledStart) * tr.width;
    const newLeft = originalLeft + (d ? clientX - d.x0 : 0);
    const frac = Math.min(1, Math.max(0, (newLeft - tr.left) / tr.width));
    const minutes = Math.round((frac * total) / SNAP) * SNAP + startMin;
    const [y, mo, day] = dateKey.split("-").map(Number);
    const start = new Date(y, mo - 1, day, Math.floor(minutes / 60), minutes % 60, 0, 0);
    return { bayId, start };
  }

  // live preview label while dragging
  let preview: string | null = null;
  if (drag?.moved) {
    const t = dropTarget(drag.id, drag.x0 + drag.dx, drag.y0 + drag.dy);
    if (t) preview = `${t.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · ${rows.find((r) => (r.id === NONE ? null : r.id) === t.bayId)?.name}`;
  }

  return (
    <div className={pending ? "opacity-60 pointer-events-none" : ""}>
      <div className="overflow-x-auto">
        <div ref={boardRef} className="min-w-[640px] select-none">
          <div className="grid" style={{ gridTemplateColumns: `${LABEL_W}px 1fr` }}>
            <div />
            <div className="relative h-5 text-[10px] text-muted">
              {hours.map((m) => <span key={m} className="absolute -translate-x-1/2" style={{ left: `${((m - startMin) / total) * 100}%` }}>{fmtHour(m)}</span>)}
            </div>
          </div>
          {rows.map((row, ri) => {
            const { placed, lanes } = laneLayout(appointments.filter((a) => (row.id === NONE ? !a.bay : a.bay?.id === row.id)));
            return (
              <div key={row.id} className={`grid items-center border-t border-border ${row.id === NONE ? "bg-bg-elevated/40" : ""}`} style={{ gridTemplateColumns: `${LABEL_W}px 1fr`, height: ROW_H }}>
                <div className="text-xs text-muted pr-2">{row.name}</div>
                <div ref={ri === 0 ? trackRef : undefined} className="relative h-full">
                  {hours.map((m) => <span key={m} className="absolute top-0 bottom-0 border-l border-border/70" style={{ left: `${((m - startMin) / total) * 100}%` }} />)}
                  {placed.map(({ item: a, lane }) => {
                    const l = pos(a.scheduledStart) * 100;
                    const r = pos(a.scheduledEnd) * 100;
                    const held = drag?.id === a.id;
                    const laneStyle = lanes > 1 ? { top: `calc(${(lane / lanes) * 100}% + 2px)`, height: `calc(${100 / lanes}% - 4px)` } : { top: 4, bottom: 4 };
                    return (
                      <div
                        key={a.id}
                        role="button"
                        tabIndex={0}
                        onPointerDown={(e) => { if (e.button !== 0) return; e.preventDefault(); setDrag({ id: a.id, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false }); }}
                        onKeyDown={(e) => { if (e.key === "Enter") router.push(`/schedule/${a.id}`); }}
                        title={`${a.serviceRequested} · ${customerName(a.customer)} — drag to reschedule`}
                        className={`absolute rounded-md border px-2 py-0.5 text-white overflow-hidden text-[11px] leading-tight cursor-grab active:cursor-grabbing hover:brightness-110 ${STATUS_BG[a.status] ?? STATUS_BG.SCHEDULED} ${held && drag?.moved ? "z-20 shadow-xl ring-2 ring-white/60" : ""}`}
                        style={{ ...laneStyle, left: `${l}%`, width: `${Math.max(3, r - l)}%`, transform: held ? `translate(${drag!.dx}px, ${drag!.dy}px)` : undefined, transition: held ? "none" : "transform .15s" }}
                      >
                        <div className="font-semibold truncate">{vehicleName(a.vehicle)}{lanes > 1 ? <span className="font-normal opacity-90"> · {a.customer.firstName} {a.customer.lastName}</span> : null}</div>
                        {lanes === 1 ? <div className="truncate opacity-90">{a.customer.firstName} {a.customer.lastName}</div> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] min-h-4">
        <span className="text-faint">Drag a block to another bay or time (snaps to {SNAP} min). Click to open.</span>
        {preview ? <span className="rounded-md bg-accent/15 text-accent px-2 py-0.5 font-medium tabular-nums">{preview}</span> : null}
        {error ? <span className="text-red-400">{error}</span> : null}
      </div>
    </div>
  );
}

function fmtHour(m: number) {
  const h = Math.floor(m / 60);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1} ${suffix}`;
}
