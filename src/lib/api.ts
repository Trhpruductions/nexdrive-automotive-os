import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { rawDb, withShop } from "./db";

/**
 * Developer API (/api/v1). Keys are issued under Settings -> API & Webhooks and
 * sent as `Authorization: Bearer nd_live_...` (or `x-api-key`). Scopes:
 *   read    - GET everything
 *   write   - create / update customers, vehicles, work orders, appointments, parts
 *   ingest  - push machine / inventory events (same as an integration key)
 */
export const API_SCOPES = ["read", "write", "ingest"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
export const newApiKey = () => `nd_live_${randomBytes(24).toString("base64url")}`;
export const newWebhookSecret = () => `whsec_${randomBytes(24).toString("base64url")}`;

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "error") {
    super(message);
  }
}

export type ApiKeyContext = { id: string; name: string; scopes: string[]; shopId: string };

/** Resolve + validate the key on a request. Throws ApiError on failure. */
export async function authenticate(req: NextRequest, scope: ApiScope): Promise<ApiKeyContext> {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : (req.headers.get("x-api-key") ?? "").trim();
  if (!key) throw new ApiError(401, "Missing API key. Send `Authorization: Bearer <key>`.", "unauthorized");
  const row = await rawDb.apiKey.findUnique({ where: { keyHash: hashKey(key) }, include: { shop: { select: { status: true } } } });
  if (!row || !row.enabled) throw new ApiError(401, "Invalid or revoked API key.", "unauthorized");
  if (row.expiresAt && row.expiresAt < new Date()) throw new ApiError(401, "API key has expired.", "unauthorized");
  if (row.shop.status === "SUSPENDED" || row.shop.status === "CANCELLED") throw new ApiError(403, "This shop's NexDrive account is suspended.", "forbidden");
  if (!row.scopes.includes(scope)) throw new ApiError(403, `This key lacks the "${scope}" scope.`, "forbidden");
  rawDb.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date(), useCount: { increment: 1 } } }).catch(() => null);
  return { id: row.id, name: row.name, scopes: row.scopes, shopId: row.shopId };
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(serialize(data), init);
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  const message = e instanceof Error ? e.message : String(e);
  if (/Record to update not found|No record was found|not found/i.test(message)) return NextResponse.json({ error: { code: "not_found", message: "Not found" } }, { status: 404 });
  console.error("[api/v1]", e);
  return NextResponse.json({ error: { code: "server_error", message: "Something went wrong" } }, { status: 500 });
}

/** Route wrapper: auth + error handling in one place. */
export function handler(scope: ApiScope, fn: (req: NextRequest, ctx: { key: ApiKeyContext; params: Record<string, string> }) => Promise<Response>) {
  return async (req: NextRequest, routeCtx?: { params?: Promise<Record<string, string>> }) => {
    try {
      const key = await authenticate(req, scope);
      const params = routeCtx?.params ? await routeCtx.params : {};
      return await withShop(key.shopId, () => fn(req, { key, params }));
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readBody<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") throw new Error();
    return body as T;
  } catch {
    throw new ApiError(400, "Body must be a JSON object.", "invalid_body");
  }
}

export function paging(req: NextRequest, defaultLimit = 50) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || defaultLimit));
  const page = Math.max(1, Number(sp.get("page")) || 1);
  return { limit, page, skip: (page - 1) * limit, q: sp.get("q")?.trim() || undefined, sp };
}

export function pageResponse<T>(items: T[], total: number, p: { limit: number; page: number }) {
  return json({ data: items, page: p.page, limit: p.limit, total, pages: Math.max(1, Math.ceil(total / p.limit)) });
}

/** Prisma Decimals -> numbers, Dates -> ISO strings, recursively. */
export function serialize(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    // decimal.js instances (Prisma Decimal) — don't rely on the constructor name, bundlers rename it
    const v = value as { toNumber?: () => number; toFixed?: unknown; d?: unknown; e?: unknown; s?: unknown };
    if (typeof v.toNumber === "function" && typeof v.toFixed === "function" && "d" in v && "e" in v && "s" in v) return v.toNumber();
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(value as Record<string, unknown>)) {
      if (k === "passwordHash" || k === "keyHash" || k === "secret" || k === "approvalToken") continue;
      out[k] = serialize(val);
    }
    return out;
  }
  return value;
}

export const str = (v: unknown, field: string, opts: { required?: boolean; max?: number } = {}) => {
  if (v == null || v === "") {
    if (opts.required) throw new ApiError(422, `"${field}" is required.`, "validation");
    return undefined;
  }
  if (typeof v !== "string") throw new ApiError(422, `"${field}" must be a string.`, "validation");
  const s = v.trim();
  if (opts.max && s.length > opts.max) throw new ApiError(422, `"${field}" is too long.`, "validation");
  return s;
};

export const num = (v: unknown, field: string, opts: { required?: boolean; int?: boolean; min?: number } = {}) => {
  if (v == null || v === "") {
    if (opts.required) throw new ApiError(422, `"${field}" is required.`, "validation");
    return undefined;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || (opts.int && !Number.isInteger(n)) || (opts.min != null && n < opts.min)) throw new ApiError(422, `"${field}" is invalid.`, "validation");
  return n;
};

export const date = (v: unknown, field: string, opts: { required?: boolean } = {}) => {
  if (v == null || v === "") {
    if (opts.required) throw new ApiError(422, `"${field}" is required.`, "validation");
    return undefined;
  }
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new ApiError(422, `"${field}" must be an ISO date/time.`, "validation");
  return d;
};
