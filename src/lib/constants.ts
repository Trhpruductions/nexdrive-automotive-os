import type {
  AppointmentStatus,
  InspectionResult,
  InvoiceStatus,
  Role,
  WorkOrderStatus,
} from "@/generated/prisma/enums";

// ───────── Modules (each shop turns these on/off in Settings → Modules) ─────────

export type ModuleKey =
  | "vehicles"
  | "customers"
  | "workOrders"
  | "schedule"
  | "estimates"
  | "invoices"
  | "parts"
  | "technicians"
  | "inspections"
  | "reports"
  | "payments"
  | "ai"
  | "production"
  | "jobs"
  | "tooling"
  | "shipments"
  | "messages"
  | "notifications";

export type ModuleDef = {
  key: ModuleKey;
  label: string;
  href: string;
  description: string;
  /** roles that can see it (undefined = all staff) */
  roles?: Role[];
  group: "main" | "comms";
};

export const MODULES: ModuleDef[] = [
  { key: "vehicles", label: "Vehicles", href: "/vehicles", description: "Vehicle profiles, history, photos", group: "main" },
  { key: "customers", label: "Customers", href: "/customers", description: "Customer records and portal access", group: "main" },
  { key: "workOrders", label: "Work Orders", href: "/work-orders", description: "Repairs from complaint to invoice", group: "main" },
  { key: "schedule", label: "Schedule", href: "/schedule", description: "Appointments, bays, technician assignments", group: "main" },
  { key: "estimates", label: "Estimates", href: "/estimates", description: "Quotes and digital customer approval", group: "main", roles: ["OWNER", "ADMIN", "SERVICE_ADVISOR"] },
  { key: "invoices", label: "Invoices", href: "/invoices", description: "Billing, taxes, receipts", group: "main", roles: ["OWNER", "ADMIN", "SERVICE_ADVISOR"] },
  { key: "parts", label: "Parts & Inventory", href: "/parts", description: "Stock levels, reorder alerts, suppliers", group: "main" },
  { key: "technicians", label: "Technicians", href: "/technicians", description: "Team, rates, utilisation", group: "main", roles: ["OWNER", "ADMIN", "SERVICE_ADVISOR"] },
  { key: "inspections", label: "Inspections", href: "/inspections", description: "Digital multi-point inspections", group: "main" },
  { key: "reports", label: "Reports", href: "/reports", description: "Revenue and shop performance", group: "main", roles: ["OWNER", "ADMIN"] },
  { key: "payments", label: "Payments", href: "/payments", description: "Payment history and outstanding balances", group: "main", roles: ["OWNER", "ADMIN", "SERVICE_ADVISOR"] },
  { key: "ai", label: "NexDrive AI", href: "/ai", description: "AI assistant with access to your shop data", group: "main" },
  { key: "production", label: "Production", href: "/production", description: "Live machine / production-line feed and inventory sync", group: "main" },
  { key: "jobs", label: "Jobs", href: "/jobs", description: "Production orders: what to make, on which press, by when", group: "main" },
  { key: "tooling", label: "Tooling", href: "/tooling", description: "Dies and tooling with hit counts and service intervals", group: "main" },
  { key: "shipments", label: "Shipments", href: "/shipments", description: "Finished goods out the door, packing slips, goods invoices", group: "main", roles: ["OWNER", "ADMIN", "SERVICE_ADVISOR"] },
  { key: "messages", label: "Messages", href: "/messages", description: "Two-way customer messaging", group: "comms" },
  { key: "notifications", label: "Notifications", href: "/notifications", description: "Customer notification outbox", group: "comms" },
];

export const ALL_MODULE_KEYS = MODULES.map((m) => m.key);

// ───────── Status metadata ─────────

export const WO_STATUS: Record<WorkOrderStatus, { label: string; tone: Tone }> = {
  ESTIMATE: { label: "Estimate", tone: "slate" },
  AWAITING_APPROVAL: { label: "Awaiting Approval", tone: "amber" },
  APPROVED: { label: "Approved", tone: "blue" },
  IN_PROGRESS: { label: "In Progress", tone: "blue" },
  ON_HOLD: { label: "Waiting Parts", tone: "orange" },
  COMPLETED: { label: "Completed", tone: "green" },
  INVOICED: { label: "Invoiced", tone: "violet" },
  CANCELLED: { label: "Cancelled", tone: "red" },
};

export const WO_STATUS_ORDER: WorkOrderStatus[] = [
  "ESTIMATE",
  "AWAITING_APPROVAL",
  "APPROVED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "INVOICED",
  "CANCELLED",
];

export const APPT_STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  SCHEDULED: { label: "Scheduled", tone: "slate" },
  CONFIRMED: { label: "Confirmed", tone: "blue" },
  CHECKED_IN: { label: "Checked In", tone: "violet" },
  IN_PROGRESS: { label: "In Progress", tone: "blue" },
  COMPLETED: { label: "Completed", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "red" },
  NO_SHOW: { label: "No Show", tone: "orange" },
};

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "slate" },
  SENT: { label: "Sent", tone: "blue" },
  PARTIAL: { label: "Partially Paid", tone: "amber" },
  PAID: { label: "Paid", tone: "green" },
  VOID: { label: "Void", tone: "red" },
};

export const INSPECTION_RESULT: Record<InspectionResult, { label: string; tone: Tone; dot: string }> = {
  GOOD: { label: "Good", tone: "green", dot: "bg-emerald-500" },
  ATTENTION: { label: "Needs Attention", tone: "amber", dot: "bg-amber-400" },
  URGENT: { label: "Urgent", tone: "red", dot: "bg-red-500" },
  NA: { label: "Not Checked", tone: "slate", dot: "bg-slate-600" },
};

export const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: "NexDrive Admin",
  OWNER: "Shop Owner",
  ADMIN: "Admin",
  SERVICE_ADVISOR: "Service Advisor",
  TECHNICIAN: "Technician",
  CUSTOMER: "Customer",
};

export type Tone = "slate" | "blue" | "green" | "amber" | "orange" | "red" | "violet";

export const TONE_CLASS: Record<Tone, string> = {
  slate: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  blue: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  green: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  orange: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  red: "bg-red-500/15 text-red-300 ring-red-500/30",
  violet: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
};

export const TONE_TEXT: Record<Tone, string> = {
  slate: "text-slate-400",
  blue: "text-blue-400",
  green: "text-emerald-400",
  amber: "text-amber-400",
  orange: "text-orange-400",
  red: "text-red-400",
  violet: "text-violet-400",
};

export const PAYMENT_METHODS = ["CARD", "CASH", "CHECK", "ACH", "OTHER"] as const;

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];
