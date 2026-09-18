// Business types. Everything NexDrive does — estimates, approvals, inspections,
// scheduling, parts, portal — works the same; what changes is the *thing being
// serviced* and the words on screen. No server-only import: used by the seed,
// the sign-up form and client components alike.

import { DEFAULT_CANNED_SERVICES, DEFAULT_INSPECTION_TEMPLATE } from "./defaults";
import type { ModuleKey } from "./constants";

/** Vocabulary for the serviced asset. `null` hides that field / concept. */
export type Terms = {
  asset: string;
  assets: string;
  /** primary identifier: "VIN", "Hull ID", "Serial number"… */
  serial: string;
  serialHint: string;
  /** can the serial be decoded with the NHTSA VIN service? */
  vinDecode: boolean;
  /** secondary tag: license plate, registration, asset tag — null hides it */
  plate: string | null;
  /** usage counter: Mileage / Hours — null hides it */
  odometer: string | null;
  odometerUnit: string;
  make: string;
  model: string;
  engine: string | null;
  transmission: string | null;
  /** the schematic on inspection reports */
  diagram: "car" | "none";
  dropOff: string;
  inShop: string;
};

export type Vertical = {
  key: string;
  label: string;
  blurb: string;
  terms: Terms;
  inspection: [string, string[]][];
  cannedServices: { name: string; description: string; laborHours: number }[];
  /** modules switched off by default for this type (all others on) */
  modulesOff: ModuleKey[];
};

const auto: Terms = { asset: "Vehicle", assets: "Vehicles", serial: "VIN", serialHint: "17 characters — decode fills year, make, model, trim, engine", vinDecode: true, plate: "License plate", odometer: "Mileage", odometerUnit: "mi", make: "Make", model: "Model", engine: "Engine", transmission: "Transmission", diagram: "car", dropOff: "I'll drop the vehicle off", inShop: "Vehicles in shop" };

export const VERTICALS: Vertical[] = [
  { key: "automotive", label: "Automotive repair", blurb: "Cars, trucks and vans — the classic service shop.", terms: auto, inspection: DEFAULT_INSPECTION_TEMPLATE, cannedServices: DEFAULT_CANNED_SERVICES, modulesOff: [] },
  {
    key: "powersports", label: "Motorcycle & powersports", blurb: "Motorcycles, ATVs, UTVs, snowmobiles, scooters.",
    terms: { ...auto, asset: "Unit", assets: "Units", dropOff: "I'll drop the unit off", inShop: "Units in shop", diagram: "none" },
    inspection: [
      ["Controls", ["Throttle & cables", "Clutch & lever", "Brake levers / pedal", "Switches & kill switch"]],
      ["Tires & Wheels", ["Front tire tread & pressure", "Rear tire tread & pressure", "Wheel bearings", "Spokes / rims"]],
      ["Drive", ["Chain / belt tension & wear", "Sprockets", "Final drive oil"]],
      ["Engine & Fluids", ["Engine oil level", "Coolant", "Air filter", "Spark plugs", "Fuel lines & leaks"]],
      ["Chassis", ["Fork seals", "Rear shock", "Steering head bearings", "Frame & fasteners"]],
      ["Lights & Electrical", ["Headlight / tail / brake lights", "Turn signals", "Battery & charging", "Horn"]],
    ],
    cannedServices: [
      { name: "Oil & Filter Service", description: "Engine oil, filter, safety check", laborHours: 0.6 },
      { name: "Chain Adjust & Lube", description: "Clean, adjust and lubricate drive chain", laborHours: 0.4 },
      { name: "Tire Replacement (each)", description: "Mount, balance, dispose old tire", laborHours: 0.8 },
      { name: "Brake Pads (per axle)", description: "Pads, clean calipers, bleed if needed", laborHours: 1 },
      { name: "Carburetor / Fuel System Clean", description: "Disassemble, ultrasonic clean, rebuild kit", laborHours: 2 },
      { name: "Winterisation / Storage Prep", description: "Fuel stabiliser, battery tender, fluids", laborHours: 1 },
    ],
    modulesOff: ["production"],
  },
  {
    key: "marine", label: "Marine & boat service", blurb: "Outboards, sterndrives, inboards, PWC and trailers.",
    terms: { asset: "Vessel", assets: "Vessels", serial: "Hull ID (HIN)", serialHint: "12-character hull identification number", vinDecode: false, plate: "Registration #", odometer: "Engine hours", odometerUnit: "h", make: "Make", model: "Model", engine: "Engine / drive", transmission: null, diagram: "none", dropOff: "I'll bring the boat in (on trailer)", inShop: "Vessels in the yard" },
    inspection: [
      ["Hull & Deck", ["Hull condition & blisters", "Transom", "Through-hulls & fittings", "Deck hardware & cleats", "Bilge & pumps"]],
      ["Engine", ["Engine oil / gear lube", "Impeller & cooling", "Belts & hoses", "Fuel filter / water separator", "Spark plugs", "Anodes"]],
      ["Steering & Controls", ["Steering play & fluid", "Throttle / shift cables", "Trim & tilt", "Kill switch / lanyard"]],
      ["Electrical", ["Battery & terminals", "Navigation lights", "Bilge pump switch", "Gauges & helm electronics"]],
      ["Safety Gear", ["PFDs", "Fire extinguisher", "Flares / signals", "Horn / whistle"]],
      ["Trailer", ["Tires & bearings", "Lights & wiring", "Winch & straps", "Brakes / coupler"]],
    ],
    cannedServices: [
      { name: "100-Hour Outboard Service", description: "Oil, gear lube, filters, plugs, impeller check", laborHours: 2.5 },
      { name: "Impeller Replacement", description: "Water pump impeller & housing inspection", laborHours: 1.5 },
      { name: "Winterisation", description: "Fog engine, drain, antifreeze, stabiliser", laborHours: 2 },
      { name: "Spring Commissioning", description: "De-winterise, batteries, test run", laborHours: 2 },
      { name: "Bottom Paint", description: "Prep and antifouling coat", laborHours: 4 },
    ],
    modulesOff: ["production"],
  },
  {
    key: "small_engine", label: "Small engine & outdoor power", blurb: "Mowers, generators, chainsaws, trimmers, pressure washers.",
    terms: { asset: "Equipment", assets: "Equipment", serial: "Serial number", serialHint: "From the data plate", vinDecode: false, plate: null, odometer: "Hours", odometerUnit: "h", make: "Brand", model: "Model", engine: "Engine", transmission: null, diagram: "none", dropOff: "I'll drop the equipment off", inShop: "Units in shop" },
    inspection: [
      ["Engine & Starting", ["Starts & idles", "Compression", "Spark plug", "Recoil / electric start", "Oil level & condition"]],
      ["Fuel System", ["Fuel condition", "Carburetor", "Fuel lines & filter", "Primer / choke"]],
      ["Air & Cooling", ["Air filter", "Cooling fins & shroud", "Exhaust / muffler"]],
      ["Drive & Attachments", ["Blades / chain / line", "Belts & pulleys", "Deck / housing", "Wheels & drive system"]],
      ["Safety", ["Operator presence control", "Guards & shields", "Throttle & stop switch"]],
    ],
    cannedServices: [
      { name: "Mower Tune-Up", description: "Oil, filter, plug, blade sharpen, deck clean", laborHours: 1 },
      { name: "Carburetor Clean / Rebuild", description: "Clean jets, new gaskets, adjust", laborHours: 1 },
      { name: "Blade Sharpen & Balance", description: "Sharpen, balance, reinstall", laborHours: 0.4 },
      { name: "Chainsaw Service", description: "Chain, bar, filter, plug, carb adjust", laborHours: 0.8 },
      { name: "Generator Service", description: "Oil, filter, plug, load test", laborHours: 1.2 },
    ],
    modulesOff: ["production"],
  },
  {
    key: "heavy_equipment", label: "Heavy equipment & fleet", blurb: "Excavators, loaders, forklifts, agricultural and fleet trucks.",
    terms: { asset: "Equipment", assets: "Equipment", serial: "Serial / PIN", serialHint: "Product identification number", vinDecode: false, plate: "Asset tag / unit #", odometer: "Hours", odometerUnit: "h", make: "Make", model: "Model", engine: "Engine", transmission: "Transmission / hydrostatic", diagram: "none", dropOff: "Service on site", inShop: "Units in shop" },
    inspection: [
      ["Engine", ["Oil level & leaks", "Coolant", "Belts & hoses", "Air filter / restriction", "Fuel filters", "Exhaust / DPF"]],
      ["Hydraulics", ["Fluid level & condition", "Hoses & fittings", "Cylinders & seals", "Pump noise / pressure"]],
      ["Undercarriage / Tires", ["Tracks / tires", "Rollers & idlers", "Wheel bolts", "Brakes"]],
      ["Electrical", ["Batteries", "Lights & beacons", "Gauges & warnings", "Wiring & connectors"]],
      ["Cab & Controls", ["Seat & belt", "Controls & joysticks", "Glass & mirrors", "Backup alarm / horn"]],
      ["Attachments & Safety", ["Bucket / forks / blade", "Pins & bushings", "Guards & ROPS", "Fire extinguisher"]],
    ],
    cannedServices: [
      { name: "250-Hour Service", description: "Engine oil & filter, fuel filters, greasing, inspection", laborHours: 3 },
      { name: "500-Hour Service", description: "250h items + hydraulic filter, air filters", laborHours: 4 },
      { name: "Hydraulic Hose Replacement", description: "Replace hose, purge, test", laborHours: 1.5 },
      { name: "Field Service Call", description: "Travel + on-site diagnosis", laborHours: 2 },
      { name: "DOT / Safety Inspection", description: "Annual inspection & report", laborHours: 1.5 },
    ],
    modulesOff: [],
  },
  {
    key: "hvac_appliance", label: "HVAC & appliance repair", blurb: "Furnaces, AC, heat pumps, refrigeration, washers, dryers.",
    terms: { asset: "Unit", assets: "Units", serial: "Serial number", serialHint: "From the rating plate", vinDecode: false, plate: "Model / rating plate", odometer: null, odometerUnit: "", make: "Brand", model: "Model", engine: "Type / capacity", transmission: null, diagram: "none", dropOff: "Service at my address", inShop: "Jobs in progress" },
    inspection: [
      ["Electrical", ["Voltage & amperage", "Capacitors", "Contactors / relays", "Wiring & connections", "Breaker / disconnect"]],
      ["Refrigerant & Cooling", ["Pressures / superheat", "Coils clean", "Condensate drain", "Refrigerant leaks"]],
      ["Airflow", ["Filter", "Blower & motor", "Ductwork / registers", "Static pressure"]],
      ["Heating", ["Ignition / burners", "Heat exchanger", "Flame sensor", "Venting / CO check"]],
      ["Controls", ["Thermostat operation", "Safety switches", "Defrost / control board"]],
    ],
    cannedServices: [
      { name: "AC Tune-Up", description: "Clean coils, check charge, electrical, drain", laborHours: 1.25 },
      { name: "Furnace Tune-Up", description: "Burners, ignition, heat exchanger, CO test", laborHours: 1.25 },
      { name: "Capacitor Replacement", description: "Diagnose & replace run capacitor", laborHours: 0.5 },
      { name: "Refrigerant Recharge", description: "Leak check, evacuate, charge", laborHours: 1.5 },
      { name: "Appliance Diagnostic", description: "Diagnose fault, quote repair", laborHours: 0.75 },
    ],
    modulesOff: ["production"],
  },
  {
    key: "electronics", label: "Electronics & device repair", blurb: "Phones, laptops, consoles, TVs, audio gear.",
    terms: { asset: "Device", assets: "Devices", serial: "Serial / IMEI", serialHint: "Serial number or IMEI", vinDecode: false, plate: null, odometer: null, odometerUnit: "", make: "Brand", model: "Model", engine: null, transmission: null, diagram: "none", dropOff: "I'll drop the device off", inShop: "Devices in shop" },
    inspection: [
      ["Power", ["Powers on", "Battery health", "Charging port", "Charger / cable"]],
      ["Display & Input", ["Screen condition", "Touch / keyboard", "Buttons & switches"]],
      ["Connectivity", ["Wi-Fi / cellular", "Bluetooth", "Ports / jacks", "Speakers & mics"]],
      ["Physical", ["Housing & frame", "Water damage indicators", "Cameras", "Cooling / fans"]],
      ["Software", ["OS version", "Storage free", "Backup taken", "Accounts / locks"]],
    ],
    cannedServices: [
      { name: "Screen Replacement", description: "OEM-grade screen, calibration, test", laborHours: 0.75 },
      { name: "Battery Replacement", description: "New battery, health check", laborHours: 0.5 },
      { name: "Charging Port Repair", description: "Port replacement, board clean", laborHours: 1 },
      { name: "Liquid Damage Treatment", description: "Ultrasonic clean, board inspection", laborHours: 1.5 },
      { name: "Diagnostic Bench Fee", description: "Full diagnosis, written quote", laborHours: 0.5 },
    ],
    modulesOff: ["production"],
  },
  {
    key: "general", label: "General repair & service", blurb: "Anything else that comes in for service — bikes, tools, instruments.",
    terms: { asset: "Item", assets: "Items", serial: "Serial number", serialHint: "Serial, if any", vinDecode: false, plate: null, odometer: null, odometerUnit: "", make: "Brand", model: "Model / type", engine: null, transmission: null, diagram: "none", dropOff: "I'll drop the item off", inShop: "Items in shop" },
    inspection: [
      ["Condition", ["Overall condition", "Wear & damage", "Missing parts"]],
      ["Function", ["Operates as intended", "Adjustments", "Noise / vibration"]],
      ["Safety", ["Guards & safety features", "Electrical cords / plugs", "Fasteners tight"]],
    ],
    cannedServices: [
      { name: "Bench Diagnostic", description: "Assess and quote", laborHours: 0.5 },
      { name: "Standard Service", description: "Clean, adjust, lubricate, test", laborHours: 1 },
      { name: "Repair Labor (per hour)", description: "General repair labor", laborHours: 1 },
    ],
    modulesOff: ["production"],
  },
  {
    key: "production", label: "Manufacturing & production", blurb: "Machines, lines and maintenance jobs with live production feeds.",
    terms: { asset: "Machine", assets: "Machines", serial: "Serial / asset ID", serialHint: "Manufacturer serial or internal asset ID", vinDecode: false, plate: "Line / station", odometer: "Run hours", odometerUnit: "h", make: "Manufacturer", model: "Model", engine: "Drive / power", transmission: null, diagram: "none", dropOff: "On-site", inShop: "Machines under maintenance" },
    inspection: [
      ["Safety", ["Guards & interlocks", "E-stops", "Lockout / tagout points", "Warning labels"]],
      ["Mechanical", ["Belts & drives", "Bearings & noise", "Lubrication", "Alignment", "Fasteners"]],
      ["Electrical & Controls", ["Cabinet & wiring", "Sensors", "PLC / HMI faults", "Motor temperature"]],
      ["Pneumatic / Hydraulic", ["Pressure", "Leaks", "Filters & lubricators"]],
      ["Housekeeping", ["Cleanliness", "Coolant / chips", "Calibration due"]],
    ],
    cannedServices: [
      { name: "Preventive Maintenance (monthly)", description: "Checklist, lube, adjustments", laborHours: 2 },
      { name: "Preventive Maintenance (annual)", description: "Full teardown inspection, wear parts", laborHours: 8 },
      { name: "Breakdown Response", description: "Diagnose and restore production", laborHours: 2 },
      { name: "Calibration", description: "Measure, adjust, certificate", laborHours: 1.5 },
    ],
    modulesOff: [],
  },
];

export const DEFAULT_VERTICAL = "automotive";

export function getVertical(key: string | null | undefined): Vertical {
  return VERTICALS.find((v) => v.key === key) ?? VERTICALS[0];
}

/** Effective vocabulary: the business type's words plus any custom overrides from Settings. */
export function termsFor(key: string | null | undefined, overrides?: Partial<Terms> | null): Terms {
  const base = getVertical(key).terms;
  if (!overrides) return base;
  const out: Terms = { ...base };
  for (const [k, v] of Object.entries(overrides)) if (v !== undefined && v !== "" && k in out) (out as unknown as Record<string, unknown>)[k] = v;
  return out;
}

/** Lower-case helpers for prose ("your vehicle", "add unit"). */
export const lc = (s: string) => s.toLowerCase();
