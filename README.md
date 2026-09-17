# NexDrive Automotive OS

Complete automotive business management software by **NexDrive Productions** — work orders, estimates with digital customer approval, invoicing & payments, digital multi-point inspections, scheduling with bays and technicians, parts & inventory, a customer portal, an AI assistant, and a live production-floor / inventory feed layer.

Every shop that runs it tailors it under **Settings**: branding (name, logo, accent colour), business details, tax & labor rates, hours, bays, which modules appear, the inspection checklist, canned services, staff roles and the machine / inventory feeds. The seeded shop is **Plex Roswell Automotive**.

Design reference: `design/nexdrive-os-mockup.png` (the 8-panel mockup) and `design/nexdrive-logo-original.png`.

## Run it

```bash
npm run dev          # http://127.0.0.1:4500
```

Requires the local PostgreSQL 13 service (database `nexdrive`, role `nexdrive` — connection string is in `.env`).

| Login | Role | Password |
| --- | --- | --- |
| owner@plexroswell.com | Shop Owner (everything incl. Settings) | nexdrive123 |
| advisor@plexroswell.com | Service Advisor | nexdrive123 |
| mike@plexroswell.com | Technician | nexdrive123 |
| john.smith@example.com | Customer portal (`/portal`) | nexdrive123 |

Reset to the demo dataset at any time:

```bash
npm run db:seed
```

## Stack

- Next.js 16 (App Router, server actions, `proxy.ts` auth gate) · React 19 · TypeScript · Tailwind 4
- Prisma 7 + `pg` driver adapter on PostgreSQL 13 (`prisma/schema.prisma`, migrations in `prisma/migrations`)
- Sessions: HS256 JWT in an httpOnly cookie (`AUTH_SECRET`), passwords with bcrypt
- NexDrive AI: Claude (`claude-opus-5`) via `@anthropic-ai/sdk` tool runner with read-mostly tools over the shop's data
- Live feeds: webhook ingest, MQTT subscriber, REST/CSV pollers → Server-Sent Events to the browser

```
src/app/(auth)/login        sign-in (staff + portal)
src/app/(app)/…             staff application (dashboard, vehicles, customers, work-orders, schedule,
                            estimates, invoices, parts, technicians, inspections, reports, payments,
                            ai, production, messages, notifications, settings, search)
src/app/(portal)/portal     customer portal
src/app/approve/[token]     public estimate approval page (link sent to the customer)
src/app/api/ingest          POST endpoint for machines / MES / ERP / inventory systems
src/app/api/live            SSE stream for the production floor
src/actions/*               server actions (all writes go through here)
src/lib/*                   db, auth, settings, money math, notifications, dashboard queries, AI, integrations
src/instrumentation.ts      starts the MQTT / polling runtime when the server boots
var/uploads                 photos and logos (served through /api/files)
```

## Environment (`.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection |
| `AUTH_SECRET` | session signing key (rotate to sign everyone out) |
| `APP_URL` | public base URL used in customer approval links |
| `ANTHROPIC_API_KEY` | enables NexDrive AI |
| `RESEND_API_KEY`, `EMAIL_FROM` | email delivery (otherwise email notifications stay queued in the outbox) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | SMS delivery |
| `NEXDRIVE_DISABLE_INTEGRATIONS=1` | skip starting MQTT/pollers (e.g. for one-off scripts) |

Portal notifications, messages, estimate links and the AI's data access work without any external service.

## Workflow

Complaint → Diagnosis → Estimate (parts, labor, fees, canned services) → **Send for approval** (email/SMS/portal link, line-by-line approval, name signature) → Repair (time clock, waiting-parts hold) → Inspection (tablet checklist with photos, shown to the customer) → Complete → **Invoice** (parts consumed from stock) → Payments.

## Production lines & inventory feeds

Settings → **Integrations** connects any data source. Everything is normalised into one event format:

```json
{ "events": [
  { "type": "machine.status",  "machine": "CNC-01", "line": "Line A", "status": "RUNNING" },
  { "type": "machine.count",   "machine": "CNC-01", "count": 12, "scrap": 1 },
  { "type": "machine.reading", "machine": "CNC-01", "metric": "spindle_temp", "value": 61.2, "unit": "C" },
  { "type": "machine.alarm",   "machine": "CNC-01", "code": "E42", "message": "Coolant low", "severity": "warning" },
  { "type": "machine.heartbeat", "machine": "CNC-01" },
  { "type": "inventory.set",   "sku": "BRK-PAD-F150", "quantity": 40 },
  { "type": "inventory.adjust","sku": "OIL-FLT-PH7317", "delta": -2, "reason": "Line pull" },
  { "type": "inventory.price", "sku": "BAT-H6-AGM", "cost": 128, "price": 219, "supplier": "NAPA" }
]}
```

| Feed type | How it connects |
| --- | --- |
| **Webhook** | Anything that can POST JSON: `POST /api/ingest` with `Authorization: Bearer <key>` (key is generated per integration and shown once). |
| **MQTT** | Subscribes to a broker (`mqtt://` or `mqtts://`) with topic wildcards. JSON payloads or bare values (`RUNNING`, `42`, `61.5`); a `topicPattern` like `plant/{line}/{machine}/status` pulls identifiers out of the topic. |
| **REST poll** | Polls a JSON endpoint on an interval (MES, ERP, supplier stock APIs) with optional headers. |
| **CSV feed** | Polls a supplier stock/price CSV and maps columns to SKU / qty / cost / price. |

Non-canonical payloads are translated with a small JSON mapping (`fields`, `statusMap`, `typeMap`, `events` path). Status words are normalised (`run`, `auto`, `1` → RUNNING; `fault`, `e-stop` → DOWN; `changeover` → MAINTENANCE…). Unknown machines and lines are created on first contact; a machine that stops reporting for 5 minutes is marked offline. PLCs on Modbus / OPC-UA / EtherNet-IP connect through any edge gateway (Node-RED, Kepware, Ignition, Siemens IoT2050, Moxa…) that publishes MQTT or posts JSON.

The demo dataset includes a webhook integration with key `nd_demo_plexroswell_feed_key`:

```bash
curl -X POST http://127.0.0.1:4500/api/ingest -H "Authorization: Bearer nd_demo_plexroswell_feed_key" -H "Content-Type: application/json" -d "{\"events\":[{\"type\":\"machine.count\",\"machine\":\"CNC-01\",\"count\":5}]}"
```

The **Production** page updates live (SSE) as events arrive. **Parts → Scan** works with any USB/Bluetooth barcode scanner for receiving and pulling stock.

## Developer API & webhooks (connect other software)

Settings → **API & Webhooks** issues keys for other systems (accounting, parts suppliers, CRMs, kiosks, Zapier…). Keys carry scopes — `read`, `write`, `ingest` — and are sent as `Authorization: Bearer nd_live_…`. `GET /api/v1` returns the endpoint index as JSON.

| Endpoint | What it does |
| --- | --- |
| `GET /api/v1/me` | key info + shop settings |
| `GET/POST /api/v1/customers`, `GET/PATCH /api/v1/customers/{id}` | customers (search with `?q=`) |
| `GET/POST /api/v1/vehicles`, `GET/PATCH /api/v1/vehicles/{id}` | vehicles + service history |
| `GET/POST /api/v1/work-orders`, `GET/PATCH /api/v1/work-orders/{id}` | estimates/work orders with lines and totals; guarded status transitions |
| `GET/POST /api/v1/appointments` | schedule |
| `GET /api/v1/invoices`, `GET /api/v1/invoices/{id}` | invoices with balances and payments |
| `GET/POST /api/v1/parts`, `GET/PATCH /api/v1/parts/{id or SKU}` | inventory; `{ "adjust": -2, "reason": "…" }` moves stock |
| `GET /api/v1/machines`, `GET /api/v1/production` | live production floor |
| `POST /api/v1/events` | push machine / inventory events (ingest scope) |

Lists paginate with `?page=&limit=` (max 200) and return `{ data, page, limit, total, pages }`. Errors are `{ error: { code, message } }` with 401/403/404/409/422 as appropriate.

**Outbound webhooks** notify other software when things happen: `customer.created`, `vehicle.created`, `work_order.created / status_changed / sent_for_approval / approved / declined`, `invoice.created / paid`, `payment.recorded`, `appointment.created / status_changed`, `part.low_stock`, `machine.status_changed / alarm`. Each delivery is a JSON envelope `{ id, event, at, data }` signed with `X-NexDrive-Signature: sha256=HMAC_SHA256(secret, body)`; failures retry twice and every delivery is logged in Settings.

## Scripts

```bash
npm run dev        # dev server on :4500
npm run build      # production build
npm run start      # production server on :4500
npm run db:migrate # apply schema changes (prisma migrate dev)
npm run db:seed    # reset to the demo dataset
npm run db:studio  # Prisma Studio
npm run lint
```
