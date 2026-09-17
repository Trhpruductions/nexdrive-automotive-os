import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { jwtVerify } from "jose";

/**
 * Multi-shop data isolation.
 *
 * `db` is a Prisma client extended so that every query on a shop-owned model is
 * automatically filtered by (and every create stamped with) the current shop:
 *   - inside a request, the shop comes from the session cookie (JWT `shop` claim,
 *     or the `nd_shop` cookie when a NexDrive super-admin is viewing a shop);
 *   - outside a request (pollers, MQTT, webhooks, seed) use `withShop(shopId, fn)`.
 * A shop-owned query with no shop context throws instead of returning other shops' data.
 *
 * `rawDb` is the unscoped client for platform-level work (login, sign-up, admin console).
 */

export const SESSION_COOKIE = "nd_session";
export const SHOP_COOKIE = "nd_shop";

type TenantCtx = { shopId: string | null; platform: boolean };
const g = globalThis as unknown as { __ndTenant?: AsyncLocalStorage<TenantCtx>; __ndRaw?: PrismaClient };
export const tenantStore: AsyncLocalStorage<TenantCtx> = g.__ndTenant ?? (g.__ndTenant = new AsyncLocalStorage<TenantCtx>());

/** Run `fn` with all shop-owned queries scoped to `shopId`. */
export function withShop<T>(shopId: string, fn: () => Promise<T>): Promise<T> {
  return tenantStore.run({ shopId, platform: false }, fn);
}

/** Run `fn` with NO scoping (platform / super-admin work). Use sparingly and deliberately. */
export function withPlatform<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStore.run({ shopId: null, platform: true }, fn);
}

// Models that carry shopId directly.
const DIRECT = new Set(["User", "Technician", "Bay", "Customer", "Vehicle", "Appointment", "WorkOrder", "Inspection", "Supplier", "Part", "Invoice", "Notification", "Message", "CannedService", "InspectionTemplateItem", "AuditLog", "Integration", "ProductionLine", "Machine", "IngestLog", "ApiKey", "WebhookEndpoint", "ShopSettings", "PurchaseOrder"]);
// Child models scoped through their parent relation.
const VIA: Record<string, string> = { WorkOrderLine: "workOrder", TimeEntry: "workOrder", InspectionItem: "inspection", VehiclePhoto: "vehicle", MaintenanceReminder: "vehicle", StockMovement: "part", Payment: "invoice", CannedServicePart: "cannedService", MachineEvent: "machine", WebhookDelivery: "endpoint", AiMessage: "user", PurchaseOrderLine: "purchaseOrder" };

const LIST_OPS = new Set(["findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "updateMany", "updateManyAndReturn", "deleteMany"]);
// WhereUniqueInput must keep the unique field at the top level, so the filter is merged flat.
const UNIQUE_OPS = new Set(["findUnique", "findUniqueOrThrow", "update", "delete"]);

async function resolveShopId(): Promise<string | null> {
  const store = tenantStore.getStore();
  if (store?.platform) return null;
  if (store?.shopId) return store.shopId;
  return shopFromRequest();
}

/** Shop from the session cookie — only works inside a request. */
async function shopFromRequest(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token || !process.env.AUTH_SECRET) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    if (payload.role === "SUPERADMIN") return jar.get(SHOP_COOKIE)?.value ?? null;
    return typeof payload.shop === "string" ? payload.shop : null;
  } catch {
    return null;
  }
}

function createRaw() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
}

export const rawDb: PrismaClient = g.__ndRaw ?? (g.__ndRaw = createRaw());

function scoped(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const direct = DIRECT.has(model);
          const via = VIA[model];
          if (!direct && !via) return query(args);
          const store = tenantStore.getStore();
          if (store?.platform) return query(args);
          const shopId = await resolveShopId();
          if (!shopId) throw new Error(`No shop context for ${model}.${operation} — sign in, or wrap the call in withShop()/withPlatform().`);
          const filter = direct ? { shopId } : { [via]: { shopId } };
          const a = (args ?? {}) as Record<string, unknown>;

          if (LIST_OPS.has(operation)) {
            a.where = a.where ? { AND: [a.where, filter] } : filter;
          } else if (UNIQUE_OPS.has(operation)) {
            a.where = { ...(a.where as object), ...filter };
          } else if (operation === "create") {
            if (direct) a.data = { ...(a.data as object), shopId };
          } else if (operation === "createMany" || operation === "createManyAndReturn") {
            if (direct) {
              const data = a.data;
              a.data = Array.isArray(data) ? data.map((d) => ({ ...d, shopId })) : { ...(data as object), shopId };
            }
          } else if (operation === "upsert") {
            a.where = { ...(a.where as object), ...filter };
            if (direct) a.create = { ...(a.create as object), shopId };
          }
          return query(a as never);
        },
      },
    },
  });
}

// Only the raw client is cached across hot reloads; the extension itself is cheap to rebuild.
export const db = scoped(rawDb);

/** The shop id for the current request / context (throws if there is none). */
export async function currentShopId(): Promise<string> {
  const id = await resolveShopId();
  if (!id) throw new Error("No shop context");
  return id;
}

/** Same, but null instead of throwing (e.g. on public pages). */
export async function currentShopIdOrNull(): Promise<string | null> {
  return resolveShopId();
}

/** Per-shop sequence numbers for work orders and invoices (atomic increment). */
export async function nextNumber(kind: "wo" | "inv" | "po", shopId?: string): Promise<number> {
  const id = shopId ?? (await currentShopId());
  const data = kind === "wo" ? { woSeq: { increment: 1 } } : kind === "inv" ? { invSeq: { increment: 1 } } : { poSeq: { increment: 1 } };
  const row = await rawDb.shop.update({ where: { id }, data, select: { woSeq: true, invSeq: true, poSeq: true } });
  return kind === "wo" ? row.woSeq : kind === "inv" ? row.invSeq : row.poSeq;
}
