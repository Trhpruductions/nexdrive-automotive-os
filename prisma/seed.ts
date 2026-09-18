import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { addDays, addHours, addMinutes, isWeekend, setHours, setMinutes, startOfDay, subDays, subMinutes } from "date-fns";
import { computeTotals } from "../src/lib/money";
import { DEFAULT_CANNED_SERVICES, DEFAULT_INSPECTION_TEMPLATE } from "../src/lib/defaults";
import { getVertical } from "../src/lib/verticals";
import { ALL_MODULE_KEYS as ALL_MODULE_KEYS_FOR_SEED } from "../src/lib/constants";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DEMO_PASSWORD = "nexdrive123";
const SHOP = "shop_plex_roswell";
let woSeq = 0;
let invSeq = 0;
const TAX_RATE = 0.07;
const LABOR_RATE = 125;

const today = startOfDay(new Date());
const at = (day: Date, h: number, m = 0) => setMinutes(setHours(day, h), m);

async function main() {
  console.log("Seeding NexDrive Automotive OS …");
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // wipe (order matters for FKs without cascade)
  await db.$transaction([
    db.payment.deleteMany(),
    db.invoice.deleteMany(),
    db.qualityCheck.deleteMany(),
    db.scrapEntry.deleteMany(),
    db.shipmentLine.deleteMany(),
    db.shipment.deleteMany(),
    db.productionRun.deleteMany(),
    db.materialLot.deleteMany(),
    db.productionJob.deleteMany(),
    db.die.deleteMany(),
    db.purchaseOrderLine.deleteMany(),
    db.purchaseOrder.deleteMany(),
    db.jobRun.deleteMany(),
    db.passwordResetToken.deleteMany(),
    db.shopMember.deleteMany(),
    db.inspectionItem.deleteMany(),
    db.inspection.deleteMany(),
    db.timeEntry.deleteMany(),
    db.workOrderLine.deleteMany(),
    db.vehiclePhoto.deleteMany(),
    db.notification.deleteMany(),
    db.message.deleteMany(),
    db.appointment.deleteMany(),
    db.workOrder.deleteMany(),
    db.maintenanceReminder.deleteMany(),
    db.vehicle.deleteMany(),
    db.cannedServicePart.deleteMany(),
    db.cannedService.deleteMany(),
    db.stockMovement.deleteMany(),
    db.part.deleteMany(),
    db.supplier.deleteMany(),
    db.inspectionTemplateItem.deleteMany(),
    db.aiMessage.deleteMany(),
    db.auditLog.deleteMany(),
    db.webhookDelivery.deleteMany(),
    db.webhookEndpoint.deleteMany(),
    db.apiKey.deleteMany(),
    db.lead.deleteMany(),
    db.machineEvent.deleteMany(),
    db.machine.deleteMany(),
    db.productionLine.deleteMany(),
    db.ingestLog.deleteMany(),
    db.integration.deleteMany(),
    db.user.deleteMany(),
    db.technician.deleteMany(),
    db.customer.deleteMany(),
    db.bay.deleteMany(),
    db.shopSettings.deleteMany(),
    db.shop.deleteMany(),
  ]);

  // ── Platform: NexDrive super-admin + the tenant shop ──
  await db.user.create({ data: { email: "admin@nexdrive.app", passwordHash: hash, name: "NexDrive Admin", role: "SUPERADMIN" } });
  await db.shop.create({ data: { id: SHOP, slug: "plex-roswell", name: "Plex Roswell Automotive", plan: "PRO", status: "ACTIVE", ownerEmail: "owner@plexroswell.com" } });

  // ── Shop (the tenant tailoring the OS) ──
  await db.shopSettings.create({
    data: {
      shopId: SHOP,
      name: "Plex Roswell Automotive",
      tagline: "Full-service automotive repair & performance",
      phone: "(575) 555-0142",
      email: "service@plexroswell.com",
      address: "2400 N Main St",
      city: "Roswell",
      state: "NM",
      zip: "88201",
      website: "https://plexroswell.com",
      taxRate: TAX_RATE,
      laborRate: LABOR_RATE,
      shopFeeRate: 0.03,
      openTime: "08:00",
      closeTime: "18:00",
      invoiceFooter: "Thank you for trusting Plex Roswell Automotive. All repairs carry a 24-month / 24,000-mile warranty on parts and labor.",
      approvalMessage: "Review your estimate below. Approve the items you'd like us to complete and we'll get started right away.",
      portalWelcome: "Track your vehicles, approve estimates and view your service history — all in one place.",
      modules: ["vehicles", "customers", "workOrders", "schedule", "estimates", "invoices", "parts", "technicians", "inspections", "reports", "payments", "production", "messages", "notifications"],
    },
  });

  const bays = await Promise.all(["Bay 1", "Bay 2", "Bay 3", "Bay 4"].map((name) => db.bay.create({ data: { shopId: SHOP, name } })));

  // ── Staff ──
  const techSpecs = [
    { name: "Mike Johnson", specialty: "Diagnostics & Electrical", color: "#2f7cf6", email: "mike@plexroswell.com" },
    { name: "James Smith", specialty: "Brakes & Suspension", color: "#22c55e", email: "james@plexroswell.com" },
    { name: "David Williams", specialty: "Engine & Drivetrain", color: "#8b5cf6", email: "david@plexroswell.com" },
    { name: "Chris Brown", specialty: "Quick Lube & Tires", color: "#f59e0b", email: "chris@plexroswell.com" },
  ];
  const techs = [];
  for (const t of techSpecs) {
    const user = await db.user.create({ data: { shopId: SHOP, email: t.email, passwordHash: hash, name: t.name, role: "TECHNICIAN" } });
    techs.push(await db.technician.create({ data: { shopId: SHOP, ...t, hourlyRate: 38, userId: user.id } }));
  }
  const [mike, james, david, chris] = techs;

  await db.user.create({ data: { shopId: SHOP, email: "owner@plexroswell.com", passwordHash: hash, name: "Shop Owner", role: "OWNER" } });
  await db.user.create({ data: { shopId: SHOP, email: "advisor@plexroswell.com", passwordHash: hash, name: "Alex Rivera", role: "SERVICE_ADVISOR" } });

  // ── Suppliers & parts ──
  const napa = await db.supplier.create({ data: { shopId: SHOP, name: "NAPA Auto Parts", phone: "(575) 555-0199", email: "orders@napa.example" } });
  const worldpac = await db.supplier.create({ data: { shopId: SHOP, name: "WorldPac", phone: "(800) 555-0123", email: "sales@worldpac.example" } });
  const partSpecs = [
    { sku: "BRK-PAD-F150", name: "Brake Pad Set (Front)", category: "Brakes", brand: "Akebono", cost: 42, price: 89.99, quantityOnHand: 4, reorderPoint: 6, location: "A-12", supplierId: napa.id },
    { sku: "BRK-ROT-300", name: "Brake Rotor 300mm", category: "Brakes", brand: "Brembo", cost: 61, price: 129.0, quantityOnHand: 8, reorderPoint: 4, location: "A-13", supplierId: worldpac.id },
    { sku: "OIL-FLT-PH7317", name: "Oil Filter", category: "Filters", brand: "Fram", cost: 4.5, price: 12.99, quantityOnHand: 6, reorderPoint: 12, location: "B-02", supplierId: napa.id },
    { sku: "AIR-FLT-CA10", name: "Air Filter", category: "Filters", brand: "K&N", cost: 18, price: 39.99, quantityOnHand: 5, reorderPoint: 8, location: "B-04", supplierId: napa.id },
    { sku: "BAT-H6-AGM", name: "Battery H6 AGM", category: "Electrical", brand: "Interstate", cost: 128, price: 219.0, quantityOnHand: 1, reorderPoint: 3, location: "C-01", supplierId: napa.id },
    { sku: "OIL-5W30-QT", name: "Full Synthetic 5W-30 (qt)", category: "Fluids", brand: "Mobil 1", cost: 5.2, price: 9.99, quantityOnHand: 96, reorderPoint: 48, location: "D-01", supplierId: worldpac.id },
    { sku: "CAB-FLT-CF10", name: "Cabin Air Filter", category: "Filters", brand: "Bosch", cost: 11, price: 29.99, quantityOnHand: 14, reorderPoint: 6, location: "B-05", supplierId: napa.id },
    { sku: "SPK-PLG-IR", name: "Iridium Spark Plug", category: "Ignition", brand: "NGK", cost: 7.5, price: 16.99, quantityOnHand: 40, reorderPoint: 16, location: "C-08", supplierId: worldpac.id },
    { sku: "WPR-22", name: 'Wiper Blade 22"', category: "Accessories", brand: "Rain-X", cost: 9, price: 21.99, quantityOnHand: 18, reorderPoint: 8, location: "E-03", supplierId: napa.id },
    { sku: "TIRE-ROT-SVC", name: "Wheel Weights (set)", category: "Tires", brand: "Perfect Equipment", cost: 3, price: 8.0, quantityOnHand: 60, reorderPoint: 20, location: "E-10", supplierId: napa.id },
    { sku: "COOL-50-GAL", name: "Coolant 50/50 (gal)", category: "Fluids", brand: "Prestone", cost: 12, price: 24.99, quantityOnHand: 12, reorderPoint: 6, location: "D-04", supplierId: worldpac.id },
    { sku: "SERP-BELT-6PK", name: "Serpentine Belt", category: "Engine", brand: "Gates", cost: 22, price: 54.99, quantityOnHand: 7, reorderPoint: 4, location: "C-11", supplierId: worldpac.id },
  ];
  const parts: Record<string, { id: string; price: number; name: string }> = {};
  for (const p of partSpecs) {
    const row = await db.part.create({ data: { ...p, shopId: SHOP } });
    parts[p.sku] = { id: row.id, price: p.price, name: p.name };
  }

  // ── Inspection template (shop-tailorable) ──
  const template: [string, string[]][] = [
    ["Exterior", ["Body & paint", "Windshield & glass", "Wiper blades", "Exterior lights", "Mirrors"]],
    ["Tires & Brakes", ["Tire tread depth", "Tire pressure", "Front brake pads", "Rear brake pads", "Rotors & drums"]],
    ["Under Hood", ["Engine oil level", "Coolant level", "Brake fluid", "Battery & terminals", "Drive belts", "Air filter"]],
    ["Under Vehicle", ["Exhaust system", "Suspension components", "Steering linkage", "Fluid leaks", "CV boots"]],
    ["Interior", ["Horn", "Dash warning lights", "Cabin air filter", "Seat belts", "HVAC operation"]],
  ];
  let order = 0;
  for (const [category, items] of template) {
    for (const name of items) await db.inspectionTemplateItem.create({ data: { shopId: SHOP, category, name, sortOrder: order++ } });
  }

  // ── Canned services ──
  const oilChange = await db.cannedService.create({
    data: { shopId: SHOP, name: "Full Synthetic Oil Change", description: "Up to 6 qt synthetic oil, filter, 21-point check", laborHours: 0.5 },
  });
  await db.cannedServicePart.createMany({
    data: [
      { cannedServiceId: oilChange.id, partId: parts["OIL-5W30-QT"].id, quantity: 6 },
      { cannedServiceId: oilChange.id, partId: parts["OIL-FLT-PH7317"].id, quantity: 1 },
    ],
  });
  const brakeJob = await db.cannedService.create({
    data: { shopId: SHOP, name: "Front Brake Job", description: "Front pads and rotors, hardware, bed-in procedure", laborHours: 2.0 },
  });
  await db.cannedServicePart.createMany({
    data: [
      { cannedServiceId: brakeJob.id, partId: parts["BRK-PAD-F150"].id, quantity: 1 },
      { cannedServiceId: brakeJob.id, partId: parts["BRK-ROT-300"].id, quantity: 2 },
    ],
  });
  await db.cannedService.create({ data: { shopId: SHOP, name: "Tire Rotation & Balance", description: "Rotate and balance four tires", laborHours: 0.75 } });
  await db.cannedService.create({ data: { shopId: SHOP, name: "Diagnostic (Check Engine)", description: "Scan, pinpoint testing, written findings", laborHours: 1.0 } });
  const tuneUp = await db.cannedService.create({ data: { shopId: SHOP, name: "Tune-Up (Plugs & Filters)", description: "Spark plugs, engine & cabin air filters", laborHours: 1.5 } });
  await db.cannedServicePart.createMany({
    data: [
      { cannedServiceId: tuneUp.id, partId: parts["SPK-PLG-IR"].id, quantity: 6 },
      { cannedServiceId: tuneUp.id, partId: parts["AIR-FLT-CA10"].id, quantity: 1 },
      { cannedServiceId: tuneUp.id, partId: parts["CAB-FLT-CF10"].id, quantity: 1 },
    ],
  });

  // ── Customers & vehicles ──
  type V = { year: number; make: string; model: string; trim?: string; color: string; plate: string; vin: string; mileage: number };
  const customerSpecs: { first: string; last: string; email: string; phone: string; vehicles: V[]; portal?: boolean }[] = [
    { first: "John", last: "Smith", email: "john.smith@example.com", phone: "(575) 555-0101", portal: true, vehicles: [
      { year: 2022, make: "Ford", model: "Mustang", trim: "GT", color: "Race Red", plate: "PLX-2201", vin: "1FA6P8CF5N5100001", mileage: 18420 },
      { year: 2019, make: "Chevrolet", model: "Silverado", trim: "1500 LT", color: "Summit White", plate: "PLX-1934", vin: "3GCUYDED9KG100002", mileage: 61200 },
    ] },
    { first: "Sarah", last: "Johnson", email: "sarah.j@example.com", phone: "(575) 555-0102", vehicles: [
      { year: 2019, make: "Chevrolet", model: "Silverado", trim: "2500HD", color: "Black", plate: "SJ-4410", vin: "1GC1KVEY8KF100003", mileage: 88350 },
    ] },
    { first: "Michael", last: "Davis", email: "mdavis@example.com", phone: "(575) 555-0103", vehicles: [
      { year: 2021, make: "Toyota", model: "Camry", trim: "SE", color: "Celestial Silver", plate: "MD-2021", vin: "4T1G11AK5MU100004", mileage: 34100 },
    ] },
    { first: "David", last: "Wilson", email: "dwilson@example.com", phone: "(575) 555-0104", vehicles: [
      { year: 2021, make: "Ford", model: "F-150", trim: "Lariat", color: "Antimatter Blue", plate: "DW-F150", vin: "1FTFW1E85MF100005", mileage: 42780 },
    ] },
    { first: "Lisa", last: "Anderson", email: "lisa.a@example.com", phone: "(575) 555-0105", vehicles: [
      { year: 2020, make: "Toyota", model: "Camry", trim: "XLE", color: "Midnight Black", plate: "LA-0020", vin: "4T1F11AK0LU100006", mileage: 51900 },
    ] },
    { first: "Robert", last: "Taylor", email: "rtaylor@example.com", phone: "(575) 555-0106", vehicles: [
      { year: 2018, make: "BMW", model: "330i", trim: "xDrive", color: "Alpine White", plate: "RT-330I", vin: "WBA8B9G50JNU00007", mileage: 73400 },
    ] },
    { first: "Emily", last: "Martinez", email: "emartinez@example.com", phone: "(575) 555-0107", vehicles: [
      { year: 2020, make: "Ford", model: "F-150", trim: "XLT", color: "Oxford White", plate: "EM-1500", vin: "1FTEW1EP4LF100008", mileage: 58200 },
    ] },
    { first: "Daniel", last: "Garcia", email: "dgarcia@example.com", phone: "(575) 555-0108", vehicles: [
      { year: 2017, make: "Honda", model: "Civic", trim: "EX", color: "Modern Steel", plate: "DG-CIVC", vin: "2HGFC2F79HH100009", mileage: 96700 },
    ] },
    { first: "Jessica", last: "Lee", email: "jlee@example.com", phone: "(575) 555-0109", vehicles: [
      { year: 2023, make: "Tesla", model: "Model 3", trim: "Long Range", color: "Pearl White", plate: "JL-EV23", vin: "5YJ3E1EB3PF100010", mileage: 12300 },
    ] },
    { first: "Marcus", last: "Hall", email: "mhall@example.com", phone: "(575) 555-0110", vehicles: [
      { year: 2016, make: "Jeep", model: "Wrangler", trim: "Unlimited", color: "Firecracker Red", plate: "MH-JEEP", vin: "1C4BJWDG6GL100011", mileage: 112400 },
    ] },
  ];

  const customers: { id: string; name: string; vehicles: { id: string; label: string; mileage: number }[] }[] = [];
  for (const c of customerSpecs) {
    const customer = await db.customer.create({
      data: { shopId: SHOP, firstName: c.first, lastName: c.last, email: c.email, phone: c.phone, city: "Roswell", state: "NM", zip: "88201", address: "123 Pecan Dr" },
    });
    if (c.portal) {
      await db.user.create({ data: { shopId: SHOP, email: c.email, passwordHash: hash, name: `${c.first} ${c.last}`, role: "CUSTOMER", customerId: customer.id } });
    }
    const vehicles = [];
    for (const v of c.vehicles) {
      const row = await db.vehicle.create({
        data: { shopId: SHOP, customerId: customer.id, year: v.year, make: v.make, model: v.model, trim: v.trim, color: v.color, licensePlate: v.plate, plateState: "NM", vin: v.vin, mileage: v.mileage },
      });
      vehicles.push({ id: row.id, label: `${v.year} ${v.make} ${v.model}`, mileage: v.mileage });
    }
    customers.push({ id: customer.id, name: `${c.first} ${c.last}`, vehicles });
  }
  const [john, sarah, michael, davidW, lisa, robert, emily, daniel, jessica, marcus] = customers;

  // ── Work orders ──
  type Line = { kind: "LABOR" | "PART" | "FEE" | "DISCOUNT"; description: string; quantity?: number; unitPrice: number; hours?: number; partId?: string; approved?: boolean; taxable?: boolean };
  const labor = (description: string, hours: number, approved = true): Line => ({ kind: "LABOR", description, hours, quantity: hours, unitPrice: LABOR_RATE, approved });
  const part = (sku: string, quantity = 1, approved = true): Line => ({ kind: "PART", description: parts[sku].name, quantity, unitPrice: parts[sku].price, partId: parts[sku].id, approved });
  const fee = (description: string, amount: number): Line => ({ kind: "FEE", description, unitPrice: amount, quantity: 1 });

  async function wo(opts: {
    customer: typeof john; vehicle: number; status: "ESTIMATE" | "AWAITING_APPROVAL" | "APPROVED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "INVOICED" | "CANCELLED";
    complaint: string; diagnosis?: string; techNotes?: string; tech?: { id: string }; bay?: { id: string }; lines: Line[]; createdDaysAgo: number; promisedInDays?: number; paid?: boolean; paidDaysAgo?: number; inspection?: boolean;
  }) {
    const v = opts.customer.vehicles[opts.vehicle];
    const createdAt = subDays(at(today, 9), opts.createdDaysAgo);
    const done = ["COMPLETED", "INVOICED"].includes(opts.status);
    const row = await db.workOrder.create({
      data: { shopId: SHOP,
        number: ++woSeq,
        customerId: opts.customer.id,
        vehicleId: v.id,
        technicianId: opts.tech?.id,
        bayId: opts.bay?.id,
        status: opts.status,
        complaint: opts.complaint,
        diagnosis: opts.diagnosis,
        technicianNotes: opts.techNotes,
        mileageIn: v.mileage,
        mileageOut: done ? v.mileage + 4 : null,
        createdAt,
        promisedAt: opts.promisedInDays != null ? at(addDays(today, opts.promisedInDays), 17) : addHours(createdAt, 8),
        sentForApprovalAt: ["AWAITING_APPROVAL", "APPROVED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "INVOICED"].includes(opts.status) ? addMinutes(createdAt, 45) : null,
        approvalToken: opts.status === "AWAITING_APPROVAL" ? `demo-${v.id.slice(-6)}` : null,
        approvedAt: ["APPROVED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "INVOICED"].includes(opts.status) ? addMinutes(createdAt, 90) : null,
        approvedBy: ["APPROVED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "INVOICED"].includes(opts.status) ? opts.customer.name : null,
        startedAt: ["IN_PROGRESS", "ON_HOLD", "COMPLETED", "INVOICED"].includes(opts.status) ? addMinutes(createdAt, 120) : null,
        completedAt: done ? addHours(createdAt, 6) : null,
        lines: {
          create: opts.lines.map((l, i) => ({
            kind: l.kind,
            description: l.description,
            quantity: l.quantity ?? 1,
            unitPrice: l.unitPrice,
            hours: l.hours,
            partId: l.partId,
            approved: l.approved ?? true,
            taxable: l.taxable ?? l.kind !== "LABOR",
            sortOrder: i,
          })),
        },
      },
      include: { lines: true },
    });

    if (opts.inspection) {
      const items = await db.inspectionTemplateItem.findMany({ orderBy: { sortOrder: "asc" } });
      const results = ["GOOD", "GOOD", "GOOD", "ATTENTION", "GOOD", "GOOD", "URGENT", "GOOD", "GOOD", "GOOD", "ATTENTION", "GOOD"] as const;
      await db.inspection.create({
        data: { shopId: SHOP,
          workOrderId: row.id,
          vehicleId: v.id,
          technicianId: opts.tech?.id,
          summary: "Multi-point inspection completed at check-in.",
          items: { create: items.map((it, i) => ({ category: it.category, name: it.name, sortOrder: i, result: results[i % results.length], notes: results[i % results.length] === "URGENT" ? "Below 2/32 — replace now" : results[i % results.length] === "ATTENTION" ? "Monitor; ~3 months of life left" : null })) },
        },
      });
    }

    if (opts.status === "INVOICED") {
      const t = computeTotals(row.lines, TAX_RATE);
      const issuedAt = addHours(createdAt, 7);
      const paidAt = opts.paidDaysAgo != null ? subDays(at(today, 15), opts.paidDaysAgo) : addHours(issuedAt, 1);
      await db.invoice.create({
        data: { shopId: SHOP,
          number: ++invSeq,
          workOrderId: row.id,
          customerId: opts.customer.id,
          issuedAt,
          dueAt: addDays(issuedAt, 14),
          subtotal: t.subtotal,
          discount: Math.abs(t.discount),
          taxRate: TAX_RATE,
          tax: t.tax,
          total: t.total,
          amountPaid: opts.paid === false ? 0 : t.total,
          status: opts.paid === false ? "SENT" : "PAID",
          payments: opts.paid === false ? undefined : { create: { amount: t.total, method: "CARD", reference: `AUTH-${Math.floor(Math.random() * 900000 + 100000)}`, paidAt } },
        },
      });
    }
    return row;
  }

  // Today's board
  const woMustang = await wo({ customer: john, vehicle: 0, status: "AWAITING_APPROVAL", complaint: "Grinding noise when braking, pedal pulsates at highway speed", diagnosis: "Front pads at 2mm, rotors scored beyond minimum thickness. Rear pads at 6mm.", tech: james, bay: bays[0], lines: [labor("Replace front pads & rotors, bed-in", 2), part("BRK-PAD-F150"), part("BRK-ROT-300", 2), labor("Brake fluid flush", 0.75, false), fee("Shop supplies", 18.5)], createdDaysAgo: 0, inspection: true });
  await wo({ customer: sarah, vehicle: 0, status: "IN_PROGRESS", complaint: "Check engine light on, rough idle at stops", diagnosis: "P0301 cylinder 1 misfire — worn plugs, coil pack 1 weak", tech: mike, bay: bays[1], lines: [labor("Diagnostic scan & pinpoint test", 1), labor("Replace spark plugs (8)", 1.5), part("SPK-PLG-IR", 8), fee("Shop supplies", 12)], createdDaysAgo: 0, inspection: true });
  await wo({ customer: michael, vehicle: 0, status: "COMPLETED", complaint: "Oil change and tire rotation", tech: chris, bay: bays[3], lines: [labor("Full synthetic oil change", 0.5), part("OIL-5W30-QT", 5), part("OIL-FLT-PH7317"), labor("Tire rotation & balance", 0.75), part("TIRE-ROT-SVC")], createdDaysAgo: 0 });
  await wo({ customer: robert, vehicle: 0, status: "ON_HOLD", complaint: "Battery dies overnight, slow crank", diagnosis: "AGM battery failed load test; parasitic draw within spec", tech: mike, lines: [labor("Battery test & parasitic draw check", 0.8), part("BAT-H6-AGM")], techNotes: "Waiting on H6 AGM from NAPA — ETA tomorrow AM", createdDaysAgo: 1 });
  await wo({ customer: emily, vehicle: 0, status: "IN_PROGRESS", complaint: "Coolant smell after long drives, level dropping", diagnosis: "Weeping upper radiator hose clamp; serpentine belt glazed", tech: david, bay: bays[2], lines: [labor("Cooling system pressure test", 0.6), labor("Replace serpentine belt & hose clamp", 1), part("SERP-BELT-6PK"), part("COOL-50-GAL")], createdDaysAgo: 0 });
  await wo({ customer: davidW, vehicle: 0, status: "APPROVED", complaint: "60k service", tech: chris, lines: [labor("60k mile service", 2.5), part("OIL-5W30-QT", 6), part("OIL-FLT-PH7317"), part("AIR-FLT-CA10"), part("CAB-FLT-CF10")], createdDaysAgo: 0, promisedInDays: 1 });
  await wo({ customer: jessica, vehicle: 0, status: "ESTIMATE", complaint: "Wants quote for wiper blades and cabin filter", lines: [part("WPR-22", 2), part("CAB-FLT-CF10"), labor("Install", 0.3)], createdDaysAgo: 0 });
  await wo({ customer: marcus, vehicle: 0, status: "AWAITING_APPROVAL", complaint: "Death wobble at 45 mph", diagnosis: "Track bar bushing worn, steering stabilizer leaking", tech: james, lines: [labor("Replace track bar & steering stabilizer", 2.5), fee("Front end alignment", 119), fee("Parts (special order)", 268.4)], createdDaysAgo: 1, inspection: true });
  await wo({ customer: daniel, vehicle: 0, status: "IN_PROGRESS", complaint: "AC blows warm", diagnosis: "Low refrigerant; small leak at Schrader valve", tech: david, lines: [labor("AC evacuate & recharge, dye test", 1.5), fee("Refrigerant R-134a", 64)], createdDaysAgo: 0 });
  await wo({ customer: lisa, vehicle: 0, status: "AWAITING_APPROVAL", complaint: "Squeal on cold start", diagnosis: "Belt tensioner weak", tech: david, lines: [labor("Replace belt tensioner & belt", 1.2), part("SERP-BELT-6PK"), fee("Tensioner assembly", 86.5)], createdDaysAgo: 0 });
  await wo({ customer: john, vehicle: 1, status: "AWAITING_APPROVAL", complaint: "Vibration under acceleration", diagnosis: "Rear driveshaft u-joint play", tech: james, lines: [labor("Replace rear u-joints", 1.8), fee("U-joint kit", 74)], createdDaysAgo: 2 });

  // History (paid invoices across the last 60 days → revenue chart)
  const history: [typeof john, number, string, Line[], number][] = [
    [john, 0, "Oil change", [labor("Full synthetic oil change", 0.5), part("OIL-5W30-QT", 6), part("OIL-FLT-PH7317")], 2],
    [sarah, 0, "Tire rotation", [labor("Tire rotation & balance", 0.75), part("TIRE-ROT-SVC")], 3],
    [robert, 0, "Brake service", [labor("Rear pads & rotors", 2), part("BRK-PAD-F150"), part("BRK-ROT-300", 2)], 5],
    [emily, 0, "Check engine diag", [labor("Diagnostic", 1), labor("Replace coil pack", 0.8), fee("Ignition coil", 68)], 6],
    [michael, 0, "Tune up", [labor("Tune-up", 1.5), part("SPK-PLG-IR", 4), part("AIR-FLT-CA10"), part("CAB-FLT-CF10")], 8],
    [davidW, 0, "Oil change", [labor("Full synthetic oil change", 0.5), part("OIL-5W30-QT", 6), part("OIL-FLT-PH7317")], 9],
    [marcus, 0, "Lift inspection", [labor("Suspension inspection", 1)], 11],
    [daniel, 0, "Battery", [labor("Battery replace", 0.4), part("BAT-H6-AGM")], 12],
    [lisa, 0, "Coolant flush", [labor("Coolant flush", 1), part("COOL-50-GAL", 2)], 14],
    [jessica, 0, "Cabin filter", [labor("Install", 0.3), part("CAB-FLT-CF10")], 16],
    [john, 1, "Front brakes", [labor("Front pads & rotors", 2), part("BRK-PAD-F150"), part("BRK-ROT-300", 2), fee("Shop supplies", 15)], 18],
    [sarah, 0, "Oil change", [labor("Full synthetic oil change", 0.5), part("OIL-5W30-QT", 8), part("OIL-FLT-PH7317")], 20],
    [robert, 0, "Alignment", [fee("4-wheel alignment", 129)], 22],
    [emily, 0, "Wipers", [part("WPR-22", 2), labor("Install", 0.2)], 24],
    [michael, 0, "AC service", [labor("AC recharge", 1.2), fee("Refrigerant", 64)], 26],
    [davidW, 0, "Belt", [labor("Serpentine belt", 0.8), part("SERP-BELT-6PK")], 28],
    [marcus, 0, "Oil change", [labor("Full synthetic oil change", 0.6), part("OIL-5W30-QT", 7), part("OIL-FLT-PH7317")], 31],
    [daniel, 0, "Brakes", [labor("Front pads", 1.5), part("BRK-PAD-F150")], 33],
    [lisa, 0, "Tune up", [labor("Tune-up", 1.5), part("SPK-PLG-IR", 4), part("AIR-FLT-CA10")], 36],
    [jessica, 0, "Tire rotation", [labor("Tire rotation", 0.75), part("TIRE-ROT-SVC")], 38],
    [john, 0, "Diag", [labor("Diagnostic", 1)], 41],
    [sarah, 0, "Suspension", [labor("Shocks (rear)", 2), fee("Shock pair", 189)], 44],
    [robert, 0, "Oil change", [labor("Full synthetic oil change", 0.5), part("OIL-5W30-QT", 6), part("OIL-FLT-PH7317")], 47],
    [emily, 0, "Coolant", [labor("Coolant flush", 1), part("COOL-50-GAL", 2)], 50],
    [michael, 0, "Brakes", [labor("Rear pads & rotors", 2), part("BRK-PAD-F150"), part("BRK-ROT-300", 2)], 53],
    [davidW, 0, "Battery", [labor("Battery replace", 0.4), part("BAT-H6-AGM")], 56],
    [marcus, 0, "Tune up", [labor("Tune-up", 2), part("SPK-PLG-IR", 6), part("AIR-FLT-CA10"), part("CAB-FLT-CF10")], 58],
  ];
  const techCycle = [mike, james, david, chris];
  let i = 0;
  for (const [c, vi, complaint, lines, daysAgo] of history) {
    await wo({ customer: c, vehicle: vi, status: "INVOICED", complaint, tech: techCycle[i++ % 4], lines, createdDaysAgo: daysAgo, paid: daysAgo !== 6, paidDaysAgo: daysAgo });
  }
  // fill every working day of the last 60 days with 3-6 more invoiced jobs so the revenue chart is realistic
  const jobPool: [string, Line[]][] = [
    ["Oil change", [labor("Full synthetic oil change", 0.5), part("OIL-5W30-QT", 6), part("OIL-FLT-PH7317")]],
    ["Front brakes", [labor("Front pads & rotors", 2), part("BRK-PAD-F150"), part("BRK-ROT-300", 2), fee("Shop supplies", 15)]],
    ["Tune-up", [labor("Tune-up", 1.5), part("SPK-PLG-IR", 6), part("AIR-FLT-CA10"), part("CAB-FLT-CF10")]],
    ["Diagnostic", [labor("Diagnostic & pinpoint test", 1.2)]],
    ["Battery", [labor("Battery replace & terminals", 0.5), part("BAT-H6-AGM")]],
    ["Tire rotation & balance", [labor("Tire rotation & balance", 0.75), part("TIRE-ROT-SVC")]],
    ["Coolant service", [labor("Coolant flush", 1), part("COOL-50-GAL", 2)]],
    ["Alignment", [fee("4-wheel alignment", 129), labor("Inspect steering", 0.4)]],
    ["Serpentine belt", [labor("Replace belt", 0.8), part("SERP-BELT-6PK")]],
    ["AC service", [labor("AC evacuate & recharge", 1.3), fee("Refrigerant", 64)]],
    ["Suspension", [labor("Replace rear shocks", 2), fee("Shock pair", 189)]],
    ["Timing service", [labor("Timing belt & water pump", 4.5), fee("Timing kit", 312)]],
  ];
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let d = 1; d <= 60; d++) {
    const day = subDays(today, d);
    if (isWeekend(day)) continue;
    const n = 3 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      const c = customers[Math.floor(rnd() * customers.length)];
      const [complaint, lines] = jobPool[Math.floor(rnd() * jobPool.length)];
      await wo({ customer: c, vehicle: 0, status: "INVOICED", complaint, tech: techCycle[Math.floor(rnd() * 4)], lines, createdDaysAgo: d, paidDaysAgo: d });
    }
  }
  for (const [complaint, lines] of jobPool.slice(0, 5)) {
    await wo({ customer: customers[Math.floor(rnd() * customers.length)], vehicle: 0, status: "INVOICED", complaint, tech: techCycle[Math.floor(rnd() * 4)], lines, createdDaysAgo: 1, paidDaysAgo: 1 });
  }
  // a few completed-today invoices so "Today's revenue" is non-zero
  await wo({ customer: jessica, vehicle: 0, status: "INVOICED", complaint: "Tire rotation & wipers", tech: chris, lines: [labor("Tire rotation & balance", 0.75), part("TIRE-ROT-SVC"), part("WPR-22", 2)], createdDaysAgo: 0 });
  await wo({ customer: daniel, vehicle: 0, status: "INVOICED", complaint: "Oil change", tech: chris, lines: [labor("Full synthetic oil change", 0.5), part("OIL-5W30-QT", 5), part("OIL-FLT-PH7317")], createdDaysAgo: 0 });
  await wo({ customer: marcus, vehicle: 0, status: "INVOICED", complaint: "Front brake job", tech: james, lines: [labor("Front pads & rotors", 2), part("BRK-PAD-F150"), part("BRK-ROT-300", 2), fee("Shop supplies", 18.5)], createdDaysAgo: 0 });
  await wo({ customer: lisa, vehicle: 0, status: "INVOICED", complaint: "Battery & terminals", tech: mike, lines: [labor("Battery replace & clean terminals", 0.6), part("BAT-H6-AGM")], createdDaysAgo: 0 });
  await wo({ customer: emily, vehicle: 0, status: "INVOICED", complaint: "Diagnostic + coil", tech: mike, lines: [labor("Diagnostic", 1), labor("Replace coil", 0.8), fee("Ignition coil", 68)], createdDaysAgo: 0 });
  await wo({ customer: robert, vehicle: 0, status: "INVOICED", complaint: "Alignment", tech: james, lines: [fee("4-wheel alignment", 129), labor("Inspect steering & suspension", 0.5)], createdDaysAgo: 0 });
  await wo({ customer: davidW, vehicle: 0, status: "INVOICED", complaint: "Cabin filter & wipers", tech: chris, lines: [part("CAB-FLT-CF10"), part("WPR-22", 2), labor("Install", 0.3)], createdDaysAgo: 0 });
  await wo({ customer: sarah, vehicle: 0, status: "INVOICED", complaint: "Tune-up", tech: david, lines: [labor("Tune-up", 1.5), part("SPK-PLG-IR", 8), part("AIR-FLT-CA10")], createdDaysAgo: 0 });

  // Time entries today (technician utilisation)
  const timeSpec: [typeof mike, number][] = [[mike, 7.4], [james, 6.8], [david, 5.2], [chris, 4.1]];
  for (const [t, hrs] of timeSpec) {
    const anyWo = await db.workOrder.findFirst({ where: { technicianId: t.id }, orderBy: { createdAt: "desc" } });
    if (anyWo) await db.timeEntry.create({ data: { workOrderId: anyWo.id, technicianId: t.id, startedAt: at(today, 8), endedAt: addMinutes(at(today, 8), Math.round(hrs * 60)) } });
  }

  // ── Appointments (today + next days) ──
  const appt = async (c: typeof john, vi: number, day: Date, h: number, dur: number, service: string, tech?: { id: string }, bay?: { id: string }, status: "SCHEDULED" | "CONFIRMED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" = "SCHEDULED") =>
    db.appointment.create({ data: { shopId: SHOP, customerId: c.id, vehicleId: c.vehicles[vi].id, scheduledStart: at(day, h), scheduledEnd: addMinutes(at(day, h), dur), serviceRequested: service, technicianId: tech?.id, bayId: bay?.id, status } });

  await appt(john, 0, today, 8, 150, "Brake replacement", james, bays[0], "IN_PROGRESS");
  await appt(michael, 0, today, 12, 90, "Oil change", chris, bays[0], "COMPLETED");
  await appt(sarah, 0, today, 8, 30, "Check-in: check engine light", mike, bays[1], "CHECKED_IN");
  await appt(sarah, 0, today, 9, 180, "Misfire repair", mike, bays[1], "IN_PROGRESS");
  await appt(michael, 0, today, 13, 120, "Brake inspection", david, bays[1]);
  await appt(davidW, 0, today, 8, 30, "Drop-off: 60k service", chris, bays[2], "CHECKED_IN");
  await appt(davidW, 0, today, 9, 150, "60k service", chris, bays[2], "CONFIRMED");
  await appt(emily, 0, today, 12, 120, "Cooling repair", david, bays[2], "IN_PROGRESS");
  await appt(lisa, 0, today, 9, 120, "Belt squeal diagnosis", david, bays[3], "COMPLETED");
  await appt(robert, 0, today, 12, 90, "Battery install (parts pending)", mike, bays[3]);
  await appt(daniel, 0, today, 14, 90, "AC recharge", david, bays[3], "IN_PROGRESS");
  await appt(jessica, 0, today, 15, 45, "Wiper & filter install", chris, bays[0]);
  await appt(marcus, 0, today, 15, 60, "Estimate review", james, bays[1], "CONFIRMED");
  await appt(john, 1, today, 16, 60, "U-joint approval visit", james, bays[2]);
  await appt(emily, 0, addDays(today, 1), 8, 60, "Oil change", chris, bays[0], "CONFIRMED");
  await appt(daniel, 0, addDays(today, 1), 10, 120, "Brake inspection", james, bays[1]);
  await appt(jessica, 0, addDays(today, 2), 9, 60, "Tire rotation", chris, bays[0]);
  await appt(robert, 0, addDays(today, 3), 13, 180, "Oil leak diagnosis", david, bays[2]);
  await appt(marcus, 0, addDays(today, 4), 8, 240, "Track bar replacement", james, bays[1]);

  // ── Reminders, notifications, messages ──
  await db.maintenanceReminder.createMany({
    data: [
      { vehicleId: john.vehicles[0].id, service: "Oil change", dueAtMileage: 23000, dueAtDate: addDays(today, 40) },
      { vehicleId: john.vehicles[1].id, service: "Transmission service", dueAtMileage: 60000, dueAtDate: subDays(today, 12) },
      { vehicleId: sarah.vehicles[0].id, service: "Differential fluid", dueAtMileage: 90000 },
      { vehicleId: robert.vehicles[0].id, service: "Brake fluid flush", dueAtDate: subDays(today, 30) },
      { vehicleId: daniel.vehicles[0].id, service: "Timing belt inspection", dueAtMileage: 100000 },
    ],
  });
  await db.notification.createMany({
    data: ([
      { customerId: john.id, workOrderId: woMustang.id, channel: "EMAIL", subject: "Your estimate is ready", body: "Hi John, your estimate for the 2022 Ford Mustang GT is ready to review and approve online.", status: "SENT", sentAt: addMinutes(at(today, 9), 47) },
      { customerId: john.id, workOrderId: woMustang.id, channel: "SMS", subject: "Estimate ready", body: "Plex Roswell Automotive: your Mustang estimate is ready — tap to approve.", status: "SENT", sentAt: addMinutes(at(today, 9), 47) },
      { customerId: john.id, workOrderId: woMustang.id, channel: "PORTAL", subject: "Estimate ready for approval", body: "Your estimate for the 2022 Ford Mustang GT is ready. Review and approve it from your portal.", status: "SENT", sentAt: addMinutes(at(today, 9), 47) },
      { customerId: michael.id, channel: "SMS", subject: "Vehicle ready", body: "Your 2021 Toyota Camry is ready for pickup. Total: see invoice.", status: "SENT", sentAt: at(today, 13, 20) },
      { customerId: robert.id, channel: "EMAIL", subject: "Parts update", body: "Your battery arrives tomorrow morning; we'll have you back on the road by noon.", status: "QUEUED" },
    ] as const).map((n) => ({ ...n, shopId: SHOP })),
  });
  await db.message.createMany({
    data: ([
      { customerId: john.id, workOrderId: woMustang.id, direction: "OUTBOUND", authorName: "Alex Rivera", body: "Hi John — James found the front rotors are below spec. Estimate is in your portal whenever you're ready.", createdAt: addMinutes(at(today, 9), 50), readAt: at(today, 10) },
      { customerId: john.id, workOrderId: woMustang.id, direction: "INBOUND", authorName: "John Smith", body: "Thanks. Is the brake fluid flush urgent or can it wait until next visit?", createdAt: at(today, 10, 5) },
      { customerId: robert.id, direction: "INBOUND", authorName: "Robert Taylor", body: "Any update on the battery? Need the car by Friday.", createdAt: at(today, 11, 30) },
    ] as const).map((m) => ({ ...m, shopId: SHOP })),
  });

  // ── Production floor: lines, machines, a webhook integration and a day of events ──
  const DEMO_KEY = "nd_demo_plexroswell_feed_key";
  const feed = await db.integration.create({
    data: { shopId: SHOP, name: "Shop floor gateway (demo)", type: "WEBHOOK", keyHash: createHash("sha256").update(DEMO_KEY).digest("hex"), keyPrefix: DEMO_KEY.slice(0, 10), config: {}, lastSeenAt: new Date(), eventCount: 0 },
  });
  const lineSvc = await db.productionLine.create({ data: { shopId: SHOP, name: "Service Floor", description: "Lifts, alignment rack, tire & dyno equipment", targetPerHour: 6, sortOrder: 0 } });
  const lineParts = await db.productionLine.create({ data: { shopId: SHOP, name: "Parts Fabrication", description: "In-house rotor machining & bracket press", targetPerHour: 20, sortOrder: 1 } });
  const DEG = "\u00b0C";
  const machineSpecs: [string, string, string, string, "RUNNING" | "IDLE" | "DOWN" | "MAINTENANCE" | "OFFLINE", Record<string, [number, string]>][] = [
    ["LIFT-01", "Lift 1 (2-post)", "Vehicle lift", lineSvc.id, "RUNNING", { load_kg: [1820, "kg"], height_cm: [168, "cm"] }],
    ["LIFT-02", "Lift 2 (2-post)", "Vehicle lift", lineSvc.id, "RUNNING", { load_kg: [2410, "kg"], height_cm: [172, "cm"] }],
    ["LIFT-03", "Lift 3 (4-post)", "Vehicle lift", lineSvc.id, "IDLE", { load_kg: [0, "kg"], height_cm: [0, "cm"] }],
    ["ALIGN-01", "Hunter HawkEye aligner", "Alignment rack", lineSvc.id, "RUNNING", { camera_temp: [31.2, DEG], jobs_today: [4, ""] }],
    ["TIRE-01", "Tire changer / balancer", "Tire equipment", lineSvc.id, "MAINTENANCE", { spindle_rpm: [0, "rpm"] }],
    ["DYNO-01", "Chassis dyno", "Dynamometer", lineSvc.id, "OFFLINE", {}],
    ["CNC-01", "Rotor lathe (on-car)", "Brake lathe", lineParts.id, "RUNNING", { spindle_rpm: [185, "rpm"], spindle_temp: [61.4, DEG], vibration: [0.8, "mm/s"] }],
    ["PRESS-01", "Hydraulic press 20T", "Press", lineParts.id, "DOWN", { pressure_bar: [0, "bar"], oil_temp: [78.9, DEG] }],
  ];
  const nowTs = new Date();
  const minutesIntoDay = nowTs.getHours() * 60 + nowTs.getMinutes();
  for (const [code, name, type, lineId, status, metrics] of machineSpecs) {
    const m = await db.machine.create({
      data: { shopId: SHOP,
        code, name, type, lineId, status, integrationId: feed.id,
        lastHeartbeatAt: status === "OFFLINE" ? subMinutes(nowTs, 47) : subMinutes(nowTs, Math.floor(rnd() * 3)),
        lastStatusChangeAt: subMinutes(nowTs, 5 + Math.floor(rnd() * 180)),
        metrics: Object.fromEntries(Object.entries(metrics).map(([k, [value, unit]]) => [k, { value, unit: unit || null, at: nowTs.toISOString() }])),
      },
    });
    const statuses = ["RUNNING", "IDLE", "RUNNING", "DOWN", "RUNNING", "IDLE", "RUNNING"] as const;
    for (let h = 24; h > 0; h -= 3) {
      await db.machineEvent.create({ data: { machineId: m.id, type: "STATUS", status: statuses[(h / 3) % statuses.length], occurredAt: subMinutes(nowTs, h * 60) } });
    }
    await db.machineEvent.create({ data: { machineId: m.id, type: "STATUS", status, message: status === "DOWN" ? "Hydraulic pressure fault" : status === "MAINTENANCE" ? "Scheduled PM" : undefined, occurredAt: m.lastStatusChangeAt! } });
    if (status !== "OFFLINE") {
      const perHour = lineId === lineParts.id ? 18 : 1;
      for (let h = 9; h >= 0; h--) {
        if (h * 60 > minutesIntoDay - 8 * 60) continue;
        const cnt = Math.max(0, Math.round(perHour * (0.6 + rnd() * 0.6)));
        if (cnt) await db.machineEvent.create({ data: { machineId: m.id, type: "COUNT", count: cnt, good: cnt - (rnd() > 0.7 ? 1 : 0), scrap: rnd() > 0.7 ? 1 : 0, occurredAt: subMinutes(nowTs, h * 60 + Math.floor(rnd() * 50)) } });
      }
      for (const [metric, [value, unit]] of Object.entries(metrics)) {
        await db.machineEvent.create({ data: { machineId: m.id, type: "READING", metric, value, unit: unit || null, occurredAt: subMinutes(nowTs, Math.floor(rnd() * 5)) } });
      }
    }
    if (status === "DOWN") await db.machineEvent.create({ data: { machineId: m.id, type: "ALARM", code: "HYD-22", message: "Hydraulic pressure below threshold", occurredAt: m.lastStatusChangeAt! } });
    if (code === "TIRE-01") await db.machineEvent.create({ data: { machineId: m.id, type: "ALARM", code: "PM-DUE", message: "500-hour service due", occurredAt: subMinutes(nowTs, 200) } });
  }
  const evCount = await db.machineEvent.count();
  await db.integration.update({ where: { id: feed.id }, data: { eventCount: evCount } });
  await db.ingestLog.create({ data: { shopId: SHOP, integrationId: feed.id, source: "webhook:Shop floor gateway (demo)", ok: true, summary: `${evCount} events applied (seed)` } });

  await db.shop.update({ where: { id: SHOP }, data: { woSeq, invSeq } });

  // ── A second, nearly empty shop so isolation is visible (owner: demo@nexdrive.app) ──
  const demo = await db.shop.create({ data: { slug: "demo-tire-lube", name: "Demo Tire & Lube", plan: "TRIAL", status: "TRIAL", trialEndsAt: addDays(today, 14), ownerEmail: "demo@nexdrive.app" } });
  await db.shopSettings.create({ data: { shopId: demo.id, name: "Demo Tire & Lube", tagline: "Fast lube & tires", phone: "(575) 555-0200", email: "hello@demotire.example", city: "Roswell", state: "NM", accentColor: "#f97316", taxRate: 0.0825, laborRate: 95 } });
  await db.user.create({ data: { shopId: demo.id, email: "demo@nexdrive.app", passwordHash: hash, name: "Dana Demo", role: "OWNER" } });
  await db.bay.createMany({ data: [{ shopId: demo.id, name: "Bay 1" }, { shopId: demo.id, name: "Bay 2" }] });
  await db.inspectionTemplateItem.createMany({ data: DEFAULT_INSPECTION_TEMPLATE.flatMap(([category, items], ci) => items.map((name, i) => ({ shopId: demo.id, category, name, sortOrder: ci * 100 + i }))) });
  await db.cannedService.createMany({ data: DEFAULT_CANNED_SERVICES.map((c) => ({ ...c, shopId: demo.id })) });
  const demoCustomer = await db.customer.create({ data: { shopId: demo.id, firstName: "Pat", lastName: "Nguyen", email: "pat@example.com", phone: "(575) 555-0301", city: "Roswell", state: "NM" } });
  const demoVehicle = await db.vehicle.create({ data: { shopId: demo.id, customerId: demoCustomer.id, year: 2018, make: "Subaru", model: "Outback", color: "Green", licensePlate: "DEMO-01", mileage: 78400 } });
  await db.workOrder.create({ data: { shopId: demo.id, number: 1, customerId: demoCustomer.id, vehicleId: demoVehicle.id, complaint: "Oil change and tire rotation", mileageIn: 78400, status: "APPROVED", approvedAt: today, approvedBy: "Pat Nguyen (in person)", lines: { create: [{ kind: "LABOR", description: "Full synthetic oil change", quantity: 0.5, hours: 0.5, unitPrice: 95, taxable: false, sortOrder: 0 }, { kind: "FEE", description: "Oil & filter", quantity: 1, unitPrice: 54.99, taxable: true, sortOrder: 1 }] } } });
  await db.shop.update({ where: { id: demo.id }, data: { woSeq: 1 } });


  // ── A metal stamping shop: presses, dies, products, material, jobs (owner: press@nexdrive.app) ──
  const stamping = getVertical("stamping");
  const press = await db.shop.create({ data: { slug: "roswell-press", name: "Roswell Press & Stamping", plan: "PRO", status: "ACTIVE", ownerEmail: "press@nexdrive.app", jobSeq: 4, shipSeq: 1 } });
  await db.shopSettings.create({ data: { shopId: press.id, name: "Roswell Press & Stamping", tagline: "Precision stamped parts since 1987", phone: "(575) 555-0400", email: "orders@roswellpress.example", address: "1800 Industrial Ave", city: "Roswell", state: "NM", zip: "88203", accentColor: "#0ea5e9", taxRate: 0.0, laborRate: 85, vertical: "stamping", modules: ALL_MODULE_KEYS_FOR_SEED.filter((m) => m !== "ai" && !stamping.modulesOff.includes(m)), shifts: [{ name: "1st", start: "06:00", end: "14:00" }, { name: "2nd", start: "14:00", end: "22:00" }], openTime: "06:00", closeTime: "22:00" } });
  await db.user.create({ data: { shopId: press.id, email: "press@nexdrive.app", passwordHash: hash, name: "Ray Alvarez", role: "OWNER" } });
  const opUser = await db.user.create({ data: { shopId: press.id, email: "operator@roswellpress.example", passwordHash: hash, name: "Luis Chavez", role: "TECHNICIAN" } });
  const op = await db.technician.create({ data: { shopId: press.id, name: "Luis Chavez", specialty: "Press operator / setup", color: "#0ea5e9", hourlyRate: 28, userId: opUser.id } });
  await db.bay.createMany({ data: [{ shopId: press.id, name: "Press bay A" }, { shopId: press.id, name: "Tool room" }] });
  await db.inspectionTemplateItem.createMany({ data: stamping.inspection.flatMap(([category, items], ci) => items.map((name, i) => ({ shopId: press.id, category, name, sortOrder: ci * 100 + i }))) });
  await db.cannedService.createMany({ data: stamping.cannedServices.map((c) => ({ ...c, shopId: press.id })) });
  const PRESS_KEY = "nd_demo_roswellpress_feed_key";
  const pressFeed = await db.integration.create({ data: { shopId: press.id, name: "Press PLC gateway (demo)", type: "WEBHOOK", keyHash: createHash("sha256").update(PRESS_KEY).digest("hex"), keyPrefix: PRESS_KEY.slice(0, 10), config: {}, lastSeenAt: new Date(), eventCount: 0 } });
  const lineA = await db.productionLine.create({ data: { shopId: press.id, name: "Line A — progressive", targetPerHour: 1800, sortOrder: 0 } });
  const lineB = await db.productionLine.create({ data: { shopId: press.id, name: "Line B — transfer", targetPerHour: 600, sortOrder: 1 } });
  const p1 = await db.machine.create({ data: { shopId: press.id, code: "PRESS-01", name: "Minster 200T straight-side", type: "Mechanical press 200T", status: "RUNNING", lineId: lineA.id, integrationId: pressFeed.id, lastHeartbeatAt: new Date(), lastStatusChangeAt: subMinutes(new Date(), 95), metrics: { run_hours: { value: 18422, unit: "h", at: new Date().toISOString() }, spm: { value: 42, unit: "spm", at: new Date().toISOString() } } } });
  const p2 = await db.machine.create({ data: { shopId: press.id, code: "PRESS-02", name: "Aida 400T servo", type: "Servo press 400T", status: "IDLE", lineId: lineA.id, integrationId: pressFeed.id, lastHeartbeatAt: new Date(), lastStatusChangeAt: subMinutes(new Date(), 20), metrics: { run_hours: { value: 6210, unit: "h", at: new Date().toISOString() } } } });
  const p3 = await db.machine.create({ data: { shopId: press.id, code: "PRESS-03", name: "Komatsu 800T transfer", type: "Transfer press 800T", status: "DOWN", lineId: lineB.id, integrationId: pressFeed.id, lastHeartbeatAt: new Date(), lastStatusChangeAt: subMinutes(new Date(), 40), metrics: { run_hours: { value: 24980, unit: "h", at: new Date().toISOString() } } } });
  await db.machineEvent.createMany({ data: [
    { machineId: p1.id, type: "STATUS", status: "RUNNING", occurredAt: subMinutes(new Date(), 95) },
    { machineId: p2.id, type: "STATUS", status: "IDLE", occurredAt: subMinutes(new Date(), 20), message: "Die change" },
    { machineId: p3.id, type: "STATUS", status: "DOWN", occurredAt: subMinutes(new Date(), 40), message: "Hydraulic overload" },
    { machineId: p3.id, type: "ALARM", code: "H-22", message: "Hydraulic overload tripped on station 3", occurredAt: subMinutes(new Date(), 40) },
  ] });
  // dies
  const dieBracket = await db.die.create({ data: { shopId: press.id, code: "D-1042", name: "Bracket progressive die (6 stations)", location: "Rack B-3", hitCount: 412300, hitsAtService: 250000, serviceIntervalHits: 200000, machineId: p1.id, notes: "Shut height 320 mm, feed pitch 45 mm, 180T" } });
  const dieClip = await db.die.create({ data: { shopId: press.id, code: "D-0877", name: "Spring clip die", location: "Rack A-1", hitCount: 88400, hitsAtService: 0, serviceIntervalHits: 150000 } });
  const dieHousing = await db.die.create({ data: { shopId: press.id, code: "D-2210", name: "Motor housing draw die", location: "Line B", hitCount: 31200, hitsAtService: 0, serviceIntervalHits: 60000, machineId: p3.id } });
  // customers (B2B)
  const aztec = await db.customer.create({ data: { shopId: press.id, firstName: "Purchasing", lastName: "Dept", company: "Aztec Truck Bodies", email: "po@aztectruck.example", phone: "(505) 555-0142", address: "4400 Commerce Dr", city: "Albuquerque", state: "NM", zip: "87109", taxExempt: true } });
  const vega = await db.customer.create({ data: { shopId: press.id, firstName: "Sam", lastName: "Ortiz", company: "Vega Motors", email: "sortiz@vegamotors.example", phone: "(806) 555-0177", address: "12 Plant Rd", city: "Lubbock", state: "TX", zip: "79401", taxExempt: true } });
  // material + products
  const coil = await db.part.create({ data: { shopId: press.id, sku: "COIL-CRS-3.0-150", name: "CRS coil 3.0 mm x 150 mm", kind: "MATERIAL", unit: "lb", category: "Coil", quantityOnHand: 9800, reorderPoint: 4000, cost: 0.62, price: 0, location: "Coil yard" } });
  const coilGalv = await db.part.create({ data: { shopId: press.id, sku: "COIL-GALV-1.2-80", name: "Galvanised coil 1.2 mm x 80 mm", kind: "MATERIAL", unit: "lb", category: "Coil", quantityOnHand: 2200, reorderPoint: 2500, cost: 0.71, price: 0, location: "Coil yard" } });
  const bracket = await db.part.create({ data: { shopId: press.id, sku: "BRK-4471-A", name: "Mounting bracket, 3 mm CRS", kind: "PRODUCT", unit: "ea", category: "Brackets", customerId: aztec.id, customerPartNumber: "ATB-88-4471", dieId: dieBracket.id, pressId: p1.id, materialPartId: coil.id, materialPerPiece: 0.42, stdRatePerHour: 1800, packQty: 500, drawingRev: "C", checkEveryPieces: 2500, checkPlan: [{ name: "Hole dia", nominal: 8.5, tolerance: 0.1, unit: "mm" }, { name: "Flange height", nominal: 22, tolerance: 0.25, unit: "mm" }, { name: "Hole-to-edge", nominal: 14, tolerance: 0.2, unit: "mm" }, { name: "Burr < 0.1 mm", nominal: null, tolerance: null, unit: null }], price: 1.85, cost: 0.74, quantityOnHand: 1250, reorderPoint: 1000, location: "FG-12" } });
  const clip = await db.part.create({ data: { shopId: press.id, sku: "CLP-0877", name: "Spring clip, galvanised", kind: "PRODUCT", unit: "ea", category: "Clips", customerId: vega.id, customerPartNumber: "VM-CL-877", dieId: dieClip.id, pressId: p2.id, materialPartId: coilGalv.id, materialPerPiece: 0.06, stdRatePerHour: 4200, packQty: 2000, drawingRev: "B", checkEveryPieces: 5000, checkPlan: [{ name: "Free width", nominal: 12.4, tolerance: 0.15, unit: "mm" }, { name: "Spring gap", nominal: 3.2, tolerance: 0.1, unit: "mm" }, { name: "No cracks at bend", nominal: null, tolerance: null, unit: null }], price: 0.22, cost: 0.09, quantityOnHand: 6400, reorderPoint: 5000, location: "FG-03" } });
  const housing = await db.part.create({ data: { shopId: press.id, sku: "HSG-2210", name: "Motor housing, deep draw", kind: "PRODUCT", unit: "ea", category: "Housings", customerId: vega.id, customerPartNumber: "VM-HSG-2210", dieId: dieHousing.id, pressId: p3.id, materialPartId: coil.id, materialPerPiece: 1.9, stdRatePerHour: 520, packQty: 48, drawingRev: "A", checkEveryPieces: 250, checkPlan: [{ name: "Draw depth", nominal: 41, tolerance: 0.3, unit: "mm" }, { name: "Bore dia", nominal: 62, tolerance: 0.05, unit: "mm" }, { name: "Wall thinning < 15%", nominal: null, tolerance: null, unit: null }], price: 7.4, cost: 3.1, quantityOnHand: 96, reorderPoint: 100, location: "FG-20" } });
  // coils on the floor, by lot / heat number (the running job is on the second CRS coil)
  const lotCrs1 = await db.materialLot.create({ data: { shopId: press.id, partId: coil.id, lotNumber: "C-240902-1", heatNumber: "H77410", supplier: "Lone Star Steel Service", quantity: 4200, remaining: 1130, unit: "lb", receivedAt: subDays(today, 15), certOnFile: true, location: "Coil yard A1" } });
  const lotCrs2 = await db.materialLot.create({ data: { shopId: press.id, partId: coil.id, lotNumber: "C-240910-2", heatNumber: "H77455", supplier: "Lone Star Steel Service", quantity: 4200, remaining: 4200, unit: "lb", receivedAt: subDays(today, 7), certOnFile: true, location: "Coil yard A2" } });
  await db.materialLot.create({ data: { shopId: press.id, partId: coil.id, lotNumber: "C-240915-1", heatNumber: "H78002", supplier: "Lone Star Steel Service", quantity: 4200, remaining: 4200, unit: "lb", receivedAt: subDays(today, 2), certOnFile: false, location: "Receiving", notes: "Mill cert not in the packet - chased supplier" } });
  const lotGalv = await db.materialLot.create({ data: { shopId: press.id, partId: coilGalv.id, lotNumber: "G-240905-1", heatNumber: "Z41190", supplier: "Gulf Coated Metals", quantity: 2800, remaining: 2192, unit: "lb", receivedAt: subDays(today, 12), certOnFile: true, location: "Coil yard B1" } });

  // jobs: one running on PRESS-01, one released, one complete & partly shipped, one planned
  const jobRunning = await db.productionJob.create({ data: { shopId: press.id, number: 1, status: "RUNNING", customerId: aztec.id, partId: bracket.id, quantity: 20000, good: 12850, scrap: 190, customerPo: "ATB-PO-77120", dueAt: addDays(today, 3), priority: 2, machineId: p1.id, dieId: dieBracket.id, lotId: lotCrs2.id, startedAt: subDays(today, 1), firstPieceAt: setMinutes(setHours(subDays(today, 1), 6), 20), runs: { create: [
    { machineId: p1.id, dieId: dieBracket.id, lotId: lotCrs1.id, technicianId: op.id, operator: "Luis Chavez", shift: "1st", startedAt: setMinutes(setHours(subDays(today, 1), 6), 5), endedAt: setMinutes(setHours(subDays(today, 1), 13), 55), good: 7200, scrap: 110, downtimeMinutes: 35, downtimeReason: "Coil change" },
    { machineId: p1.id, dieId: dieBracket.id, lotId: lotCrs2.id, operator: "Night crew", shift: "2nd", startedAt: setMinutes(setHours(subDays(today, 1), 14), 0), endedAt: setMinutes(setHours(subDays(today, 1), 21), 50), good: 4100, scrap: 60, downtimeMinutes: 20, downtimeReason: "Sensor fault" },
    { machineId: p1.id, dieId: dieBracket.id, lotId: lotCrs2.id, technicianId: op.id, operator: "Luis Chavez", shift: "1st", startedAt: subMinutes(new Date(), 95), good: 1550, scrap: 20 },
  ] } } });
  await db.qualityCheck.createMany({ data: [
    { shopId: press.id, jobId: jobRunning.id, kind: "FIRST_PIECE", result: "PASS", pieceCount: 3, inspector: "Ray Alvarez", dieId: dieBracket.id, lotId: lotCrs1.id, checkedAt: setMinutes(setHours(subDays(today, 1), 6), 20), measurements: [{ name: "Hole dia", nominal: 8.5, tolerance: 0.1, unit: "mm", actual: 8.52, ok: true }, { name: "Flange height", nominal: 22, tolerance: 0.25, unit: "mm", actual: 21.9, ok: true }, { name: "Hole-to-edge", nominal: 14, tolerance: 0.2, unit: "mm", actual: 14.05, ok: true }, { name: "Burr < 0.1 mm", nominal: null, tolerance: null, unit: null, actual: null, ok: true }] },
    { shopId: press.id, jobId: jobRunning.id, kind: "IN_PROCESS", result: "PASS", pieceCount: 2600, inspector: "Luis Chavez", dieId: dieBracket.id, lotId: lotCrs1.id, checkedAt: setMinutes(setHours(subDays(today, 1), 8), 40), measurements: [{ name: "Hole dia", nominal: 8.5, tolerance: 0.1, unit: "mm", actual: 8.54, ok: true }, { name: "Flange height", nominal: 22, tolerance: 0.25, unit: "mm", actual: 22.1, ok: true }, { name: "Hole-to-edge", nominal: 14, tolerance: 0.2, unit: "mm", actual: 14.1, ok: true }, { name: "Burr < 0.1 mm", nominal: null, tolerance: null, unit: null, actual: null, ok: true }] },
    { shopId: press.id, jobId: jobRunning.id, kind: "IN_PROCESS", result: "FAIL", pieceCount: 5100, inspector: "Luis Chavez", dieId: dieBracket.id, lotId: lotCrs1.id, checkedAt: setMinutes(setHours(subDays(today, 1), 10), 50), notes: "Burr on the trailing edge - coil end. Changed coil, re-checked.", measurements: [{ name: "Hole dia", nominal: 8.5, tolerance: 0.1, unit: "mm", actual: 8.5, ok: true }, { name: "Flange height", nominal: 22, tolerance: 0.25, unit: "mm", actual: 22, ok: true }, { name: "Hole-to-edge", nominal: 14, tolerance: 0.2, unit: "mm", actual: 14, ok: true }, { name: "Burr < 0.1 mm", nominal: null, tolerance: null, unit: null, actual: null, ok: false }] },
    { shopId: press.id, jobId: jobRunning.id, kind: "IN_PROCESS", result: "PASS", pieceCount: 5140, inspector: "Ray Alvarez", dieId: dieBracket.id, lotId: lotCrs2.id, checkedAt: setMinutes(setHours(subDays(today, 1), 11), 25), measurements: [{ name: "Hole dia", nominal: 8.5, tolerance: 0.1, unit: "mm", actual: 8.49, ok: true }, { name: "Flange height", nominal: 22, tolerance: 0.25, unit: "mm", actual: 22.05, ok: true }, { name: "Hole-to-edge", nominal: 14, tolerance: 0.2, unit: "mm", actual: 13.95, ok: true }, { name: "Burr < 0.1 mm", nominal: null, tolerance: null, unit: null, actual: null, ok: true }] },
    { shopId: press.id, jobId: jobRunning.id, kind: "IN_PROCESS", result: "PASS", pieceCount: 10200, inspector: "Night crew", dieId: dieBracket.id, lotId: lotCrs2.id, checkedAt: setMinutes(setHours(subDays(today, 1), 19), 10), measurements: [{ name: "Hole dia", nominal: 8.5, tolerance: 0.1, unit: "mm", actual: 8.51, ok: true }, { name: "Flange height", nominal: 22, tolerance: 0.25, unit: "mm", actual: 21.95, ok: true }, { name: "Hole-to-edge", nominal: 14, tolerance: 0.2, unit: "mm", actual: 14.02, ok: true }, { name: "Burr < 0.1 mm", nominal: null, tolerance: null, unit: null, actual: null, ok: true }] },
  ] });
  await db.scrapEntry.createMany({ data: [
    { shopId: press.id, jobId: jobRunning.id, dieId: dieBracket.id, lotId: lotCrs1.id, quantity: 60, reason: "Coil end / setup", at: setMinutes(setHours(subDays(today, 1), 6), 30) },
    { shopId: press.id, jobId: jobRunning.id, dieId: dieBracket.id, lotId: lotCrs1.id, quantity: 40, reason: "Burr / edge", at: setMinutes(setHours(subDays(today, 1), 10), 45), notes: "Trailing edge, coil end" },
    { shopId: press.id, jobId: jobRunning.id, dieId: dieBracket.id, lotId: lotCrs2.id, quantity: 35, reason: "Mis-feed", at: setMinutes(setHours(subDays(today, 1), 16), 0) },
    { shopId: press.id, jobId: jobRunning.id, dieId: dieBracket.id, lotId: lotCrs2.id, quantity: 25, reason: "Slug mark", at: setMinutes(setHours(subDays(today, 1), 20), 15) },
    { shopId: press.id, jobId: jobRunning.id, dieId: dieBracket.id, lotId: lotCrs2.id, quantity: 20, reason: "Coil end / setup", at: subMinutes(new Date(), 90) },
  ] });
  const jobDone = await db.productionJob.create({ data: { shopId: press.id, number: 2, status: "COMPLETE", customerId: vega.id, partId: clip.id, quantity: 10000, good: 10040, scrap: 85, shipped: 6000, customerPo: "VM-4410", dueAt: addDays(today, 1), machineId: p2.id, dieId: dieClip.id, lotId: lotGalv.id, startedAt: subDays(today, 4), completedAt: subDays(today, 2), materialUsed: 607.5, firstPieceAt: setMinutes(setHours(subDays(today, 4), 6), 15), runs: { create: [
    { machineId: p2.id, dieId: dieClip.id, lotId: lotGalv.id, operator: "Luis Chavez", shift: "1st", startedAt: setHours(subDays(today, 4), 6), endedAt: setHours(subDays(today, 4), 14), good: 5900, scrap: 40, downtimeMinutes: 25, downtimeReason: "Die change" },
    { machineId: p2.id, dieId: dieClip.id, lotId: lotGalv.id, operator: "Night crew", shift: "2nd", startedAt: setHours(subDays(today, 3), 14), endedAt: setHours(subDays(today, 3), 21), good: 4140, scrap: 45 },
  ] } } });
  await db.qualityCheck.createMany({ data: [
    { shopId: press.id, jobId: jobDone.id, kind: "FIRST_PIECE", result: "PASS", pieceCount: 2, inspector: "Ray Alvarez", dieId: dieClip.id, lotId: lotGalv.id, checkedAt: setMinutes(setHours(subDays(today, 4), 6), 15), measurements: [{ name: "Free width", nominal: 12.4, tolerance: 0.15, unit: "mm", actual: 12.42, ok: true }, { name: "Spring gap", nominal: 3.2, tolerance: 0.1, unit: "mm", actual: 3.18, ok: true }, { name: "No cracks at bend", nominal: null, tolerance: null, unit: null, actual: null, ok: true }] },
    { shopId: press.id, jobId: jobDone.id, kind: "IN_PROCESS", result: "PASS", pieceCount: 5200, inspector: "Luis Chavez", dieId: dieClip.id, lotId: lotGalv.id, checkedAt: setMinutes(setHours(subDays(today, 4), 12), 30), measurements: [{ name: "Free width", nominal: 12.4, tolerance: 0.15, unit: "mm", actual: 12.45, ok: true }, { name: "Spring gap", nominal: 3.2, tolerance: 0.1, unit: "mm", actual: 3.22, ok: true }, { name: "No cracks at bend", nominal: null, tolerance: null, unit: null, actual: null, ok: true }] },
    { shopId: press.id, jobId: jobDone.id, kind: "FINAL", result: "PASS", pieceCount: 10040, inspector: "Ray Alvarez", dieId: dieClip.id, lotId: lotGalv.id, checkedAt: setMinutes(setHours(subDays(today, 2), 9), 0), notes: "Sample of 32 per AQL 1.0", measurements: [{ name: "Free width", nominal: 12.4, tolerance: 0.15, unit: "mm", actual: 12.41, ok: true }, { name: "Spring gap", nominal: 3.2, tolerance: 0.1, unit: "mm", actual: 3.2, ok: true }, { name: "No cracks at bend", nominal: null, tolerance: null, unit: null, actual: null, ok: true }] },
  ] });
  await db.scrapEntry.createMany({ data: [
    { shopId: press.id, jobId: jobDone.id, dieId: dieClip.id, lotId: lotGalv.id, quantity: 30, reason: "Coil end / setup", at: setMinutes(setHours(subDays(today, 4), 6), 30) },
    { shopId: press.id, jobId: jobDone.id, dieId: dieClip.id, lotId: lotGalv.id, quantity: 35, reason: "Split / crack", at: setHours(subDays(today, 3), 16), notes: "Bend radius - galv flaking at the coil edge" },
    { shopId: press.id, jobId: jobDone.id, dieId: dieClip.id, lotId: lotGalv.id, quantity: 20, reason: "Mis-feed", at: setHours(subDays(today, 3), 19) },
  ] });
  await db.productionJob.create({ data: { shopId: press.id, number: 3, status: "RELEASED", customerId: vega.id, partId: housing.id, quantity: 1200, customerPo: "VM-4432", dueAt: addDays(today, 6), machineId: p3.id, dieId: dieHousing.id, notes: "Waiting on PRESS-03 hydraulic repair" } });
  await db.productionJob.create({ data: { shopId: press.id, number: 4, status: "PLANNED", customerId: aztec.id, partId: bracket.id, quantity: 15000, customerPo: "ATB-PO-77188", dueAt: addDays(today, 12) } });
  // one shipment already out and invoiced
  const ship1 = await db.shipment.create({ data: { shopId: press.id, number: 1, status: "SHIPPED", customerId: vega.id, shipDate: subDays(today, 1), carrier: "Saia LTL", tracking: "SAIA-7741-2201", shipTo: "Vega Motors\nDock 4, 12 Plant Rd\nLubbock, TX 79401", lines: { create: [{ partId: clip.id, jobId: jobDone.id, quantity: 6000, unitPrice: 0.22 }] } } });
  await db.invoice.create({ data: { shopId: press.id, number: 1, shipmentId: ship1.id, customerId: vega.id, status: "SENT", issuedAt: subDays(today, 1), dueAt: addDays(today, 29), subtotal: 1320, discount: 0, taxRate: 0, tax: 0, total: 1320, payToken: "demo-press-inv-1" } });
  await db.shop.update({ where: { id: press.id }, data: { invSeq: 1 } });
  await db.stockMovement.createMany({ data: [
    { partId: clip.id, delta: 10040, reason: "Produced", reference: "JOB-00002", createdAt: subDays(today, 2) },
    { partId: clip.id, delta: -6000, reason: "Shipped", reference: "SH-00001", createdAt: subDays(today, 1) },
    { partId: coilGalv.id, delta: -608, reason: "Consumed in production", reference: "JOB-00002", createdAt: subDays(today, 2) },
  ] });
  void jobRunning;

  const counts = {
    users: await db.user.count(), customers: await db.customer.count(), vehicles: await db.vehicle.count(),
    workOrders: await db.workOrder.count(), invoices: await db.invoice.count(), appointments: await db.appointment.count(), parts: await db.part.count(),
  };
  console.log("Seeded:", counts);
  console.log(`\nDemo webhook key (Settings > Integrations): ${DEMO_KEY}`);
  console.log(`\nLogins (password: ${DEMO_PASSWORD})\n  admin@nexdrive.app        NexDrive platform admin (/admin)\n  owner@plexroswell.com     Plex Roswell - Shop Owner\n  advisor@plexroswell.com   Plex Roswell - Service Advisor\n  mike@plexroswell.com      Plex Roswell - Technician\n  john.smith@example.com    Plex Roswell - Customer portal\n  demo@nexdrive.app         Demo Tire & Lube - Shop Owner (second shop)\n  press@nexdrive.app        Roswell Press & Stamping - Owner (press shop demo; feed key nd_demo_roswellpress_feed_key)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
