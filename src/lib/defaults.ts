// Shared platform defaults (no server-only import so the seed script can use them too).

/** Default multi-point inspection checklist every new shop starts with (editable in Settings). */
export const DEFAULT_INSPECTION_TEMPLATE: [string, string[]][] = [
  ["Exterior", ["Body & paint", "Windshield & glass", "Wiper blades", "Exterior lights", "Mirrors"]],
  ["Tires & Brakes", ["Tire tread depth", "Tire pressure", "Front brake pads", "Rear brake pads", "Rotors & drums"]],
  ["Under Hood", ["Engine oil level", "Coolant level", "Brake fluid", "Battery & terminals", "Drive belts", "Air filter"]],
  ["Under Vehicle", ["Exhaust system", "Suspension components", "Steering linkage", "Fluid leaks", "CV boots"]],
  ["Interior", ["Horn", "Dash warning lights", "Cabin air filter", "Seat belts", "HVAC operation"]],
];

export const DEFAULT_CANNED_SERVICES: { name: string; description: string; laborHours: number }[] = [
  { name: "Full Synthetic Oil Change", description: "Oil, filter, multi-point check", laborHours: 0.5 },
  { name: "Tire Rotation & Balance", description: "Rotate and balance four tires", laborHours: 0.75 },
  { name: "Front Brake Job", description: "Front pads and rotors, bed-in procedure", laborHours: 2 },
  { name: "Diagnostic (Check Engine)", description: "Scan, pinpoint testing, written findings", laborHours: 1 },
  { name: "Tune-Up (Plugs & Filters)", description: "Spark plugs, engine & cabin air filters", laborHours: 1.5 },
];

export function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "shop";
}
