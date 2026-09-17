import { NextResponse } from "next/server";
import { rawDb } from "@/lib/db";

/** Liveness / readiness for load balancers and Docker health checks. */
export async function GET() {
  try {
    await rawDb.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", time: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, db: "down", error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
