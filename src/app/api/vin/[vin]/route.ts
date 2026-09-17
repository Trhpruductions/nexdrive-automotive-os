import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * GET /api/vin/{vin} — decodes a VIN with the free NHTSA vPIC service and returns the
 * fields the vehicle form uses. Staff-only (it's a convenience, not a public proxy).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ vin: string }> }) {
  const user = await getSession();
  if (!user || user.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { vin } = await ctx.params;
  const clean = vin.trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{11,17}$/.test(clean)) return NextResponse.json({ error: "VIN must be 17 characters (letters and digits, no I/O/Q)" }, { status: 422 });
  try {
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(clean)}?format=json`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!res.ok) throw new Error(`NHTSA responded ${res.status}`);
    const data = (await res.json()) as { Results?: Record<string, string>[] };
    const r = data.Results?.[0] ?? {};
    const pick = (k: string) => (r[k] && r[k] !== "Not Applicable" ? r[k].trim() : "");
    const year = Number(pick("ModelYear")) || null;
    const make = pick("Make");
    if (!make && !year) return NextResponse.json({ error: r.ErrorText?.split(";")[0] || "VIN not recognised" }, { status: 404 });
    const cyl = pick("EngineCylinders");
    const disp = pick("DisplacementL");
    const engine = [disp ? `${Number(disp).toFixed(1)}L` : "", cyl ? `${cyl}-cyl` : "", pick("FuelTypePrimary"), pick("EngineModel")].filter(Boolean).join(" ");
    return NextResponse.json({
      vin: clean,
      year,
      make: make ? make[0] + make.slice(1).toLowerCase() : "",
      model: pick("Model"),
      trim: pick("Trim") || pick("Series"),
      engine,
      transmission: [pick("TransmissionStyle"), pick("TransmissionSpeeds") ? `${pick("TransmissionSpeeds")}-speed` : ""].filter(Boolean).join(" "),
      bodyClass: pick("BodyClass"),
      driveType: pick("DriveType"),
      plant: [pick("PlantCity"), pick("PlantCountry")].filter(Boolean).join(", "),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Decode failed" }, { status: 502 });
  }
}
