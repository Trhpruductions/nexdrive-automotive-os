# NexDrive Automotive OS

Complete automotive business management software by **NexDrive Productions** — work orders, estimates with digital customer approval, invoicing & payments, digital multi-point inspections, scheduling with bays and technicians, parts & inventory, a customer portal, an AI assistant, and a live production-floor / inventory feed layer.

**Not just cars.** Each shop picks a *business type* — automotive, motorcycle & powersports, marine, small engine & outdoor power, heavy equipment & fleet, HVAC & appliance, electronics & device repair, general repair, or manufacturing & production — at sign-up or under Settings → Business type. The type sets the vocabulary everywhere (Vehicle → Vessel / Unit / Device / Machine, VIN → Hull ID / Serial / IMEI, mileage → hours or nothing), which fields show on the asset form and booking page, the starting inspection checklist and service packages, and which modules are on. Any word can be overridden per shop; data is never changed. (`src/lib/verticals.ts`)

Every shop that runs it tailors it under **Settings**: branding (name, logo, accent colour), business details, tax & labor rates, hours, bays, which modules appear, the inspection checklist, canned services, customer notification templates, staff roles and the machine / inventory feeds. The seeded shop is **Plex Roswell Automotive**.

Design reference: `design/nexdrive-os-mockup.png` (the 8-panel mockup) and `design/nexdrive-logo-original.png`.

## Run it

```bash
npm run dev          # http://127.0.0.1:4500
```

Requires the local PostgreSQL 13 service (database `nexdrive`, role `nexdrive` — connection string is in `.env`).

| Login | Role | Password |
| --- | --- | --- |
| admin@nexdrive.app | NexDrive platform admin (`/admin`) — all shops, plans, trials, leads | nexdrive123 |
| owner@plexroswell.com | Plex Roswell Automotive — Shop Owner (everything incl. Settings) | nexdrive123 |
| advisor@plexroswell.com | Plex Roswell — Service Advisor | nexdrive123 |
| mike@plexroswell.com | Plex Roswell — Technician | nexdrive123 |
| john.smith@example.com | Plex Roswell — Customer portal (`/portal`) | nexdrive123 |
| demo@nexdrive.app | Demo Tire & Lube — a second, separate shop | nexdrive123 |

New shops self-serve at `/signup` (14-day trial, every module enabled).

## Multi-shop (SaaS)

**Multiple locations.** An owner can run several shops under one login: the admin console adds a location for an existing owner (or grants an existing staff login access to a shop with a role), and a location switcher appears in the header. Each location keeps its own customers, data, settings, branding and numbering — the session simply carries which one is active, and the isolation layer scopes everything to it.

**Plans & billing.** Every new shop starts a 14-day trial; a banner counts down the last week and the hourly scheduler suspends expired trials (data is kept). Owners manage their plan at `/billing`. With NexDrive's own Stripe keys in the environment (`STRIPE_PLATFORM_SECRET_KEY`, `STRIPE_PLATFORM_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`) that page sells Starter/Pro through Stripe Checkout and the webhook at `/api/stripe/platform` keeps the shop's plan, status and renewal date in step (failed payment → "past due" banner; cancelled → suspended until the owner re-subscribes). Without those keys, plans are set by hand in the admin console.


One installation serves any number of shops. Every shop-owned table carries a `shopId`, and `src/lib/db.ts` wraps Prisma so that **every query is filtered to the current shop automatically** (from the session, or `withShop()` for background work) — a shop-scoped query with no shop context throws rather than leaking. Work-order and invoice numbers are per-shop sequences. Staff logins belong to one shop; `SUPERADMIN` users (NexDrive Productions) manage all shops from `/admin`, can open any shop, change plans/status/trials, reset owner passwords and review website leads. Suspended shops cannot sign in and their API keys stop working.

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

Around that core:

- **Scheduling** — day board with drag-and-drop: drag a block to another bay or time slot (snaps to 15 min); bay and technician conflicts are flagged and can be overridden. Overlapping bookings stack in lanes so nothing is hidden.
- **Purchase orders** — Parts → Purchase orders. Low-stock parts are pre-filled with a reorder quantity; orders go draft → sent → (partially) received. Receiving adds stock, records a movement per part and updates the part's cost. Each order prints as a supplier sheet.
- **VIN decode** — the vehicle form's *Decode* button fills year/make/model/trim/engine/transmission from the NHTSA vPIC database (`GET /api/vin/{vin}`).
- **Printable inspection reports** — every inspection has a print view (`/inspections/{id}/print`) and the customer sees the same report in the portal.
- **Notification templates** — Settings → Notification templates edits the wording of every customer message (estimate ready, vehicle ready, waiting on parts, appointment booked/confirmed, invoice ready, payment received) with `{customer} {vehicle} {shop} {total} {link} {date} {time} …` placeholders.
- **Reports** — collected vs prior period, revenue mix, monthly trend, payments by method, technician performance, AR aging with the oldest open invoices, sales tax by month, parts sales & margin by category, and customer retention.
- **Online booking** — every shop gets a public page at `/book/{slug}` (link under Settings → Business). Customers book without an account; the request lands in Schedule and Messages for the shop to confirm, and the customer + vehicle are created or matched automatically.
- **Card payments** — a shop enters its own Stripe keys under Settings → Payments and customers pay invoice balances from the portal. The webhook records the payment, marks the invoice paid and fires the usual `payment.recorded` / `invoice.paid` webhooks.
- **Maintenance reminders** — due (within 14 days / 500 miles) reminders go out automatically every hour through the `reminder_due` template, once each; Settings → Notification templates has a "send now" button.
- **CSV exports** — customers, vehicles, work orders, invoices, payments and parts (`/api/export/{entity}`, optional `?from=&to=`), from the Export button on each list.
- **Accounts** — forgot-password with one-hour single-use links (email via Resend or SMTP), change-your-own-password under My account / portal account, and sign-in lockout after 10 failed attempts per email + IP.
- **Import data** — Settings → Import data takes a CSV from the old system (customers, vehicles, parts), auto-matches columns, previews, and imports in chunks. Existing records are matched (email/phone/name, VIN/plate, SKU) and updated rather than duplicated.
- **Activity log** — Settings → Activity log shows who did what (logins, payments, receipts, resets…), filterable by action.
- **Custom 404 / error pages** so a bad link or a failed render never drops the user on a blank screen.
- **Technician "My day"** — technicians sign in to their own dashboard: the job they're clocked on, their open jobs with one-tap Start/Stop, today's appointments and inspections still to do. Built for a phone or bay tablet.
- **Text-to-pay** — every invoice has a public link (`/pay/{token}`, shown on the invoice as *Customer pay link* and inserted as `{link}` in the invoice message). The customer sees the invoice and, when the shop has Stripe set up, pays by card — no account needed.
- **Installable** — NexDrive is a PWA: "Add to Home Screen" on iPad / Android / iPhone gives a full-screen app with the shop's icon. Baseline security headers (nosniff, frame-ancestors, referrer policy, HSTS in production) are set for every response.
- **Outbox retry** — queued email/SMS are re-sent automatically every hour once a provider is configured (and on demand with *Retry queued* on the Notifications page).
- **Appointment reminders** — the day before every scheduled/confirmed appointment the customer gets the `appointment_reminder` message (once, tracked per appointment).
- **Service intervals** — give a canned service "repeat every 5,000 mi / 6 months" and invoicing it schedules the next maintenance reminder for that vehicle automatically (superseding the previous one), which the hourly reminder job then sends when due.
- **Branded email** — every customer email goes out as HTML with the shop's logo, accent colour and a button for the link (approval, pay link, dashboard), with plain text alongside.
- **Two-way SMS** — point the Twilio number's inbound webhook at `/api/twilio/inbound` (signature-checked) and customer texts land in Messages, matched by phone; unknown numbers get their own thread; STOP is noted on the customer.
- **Owner's daily digest** — an end-of-day email (collected, invoiced, completed, estimates going stale, parts to reorder, tomorrow's schedule), on by default under Settings → Business.
- **Estimate follow-ups** — an estimate the customer hasn't answered in two days gets one "still thinking it over?" nudge with the approval link (`estimate_followup` template); re-sending the estimate resets it.
- **Purchase orders by email** — *Mark as sent* emails the order sheet to the supplier when they have an email address and a mail provider is configured.
- **Deferred & recommended work** — lines a customer declined on earlier jobs and urgent/attention inspection findings follow the vehicle: the vehicle page lists them, and an open work order shows *Suggested for this estimate* with one-click *Add to estimate* (a finding becomes a labor line to price up; a declined line comes back as it was).
- **Technician efficiency** — Reports compare billed hours with clocked hours per technician.
- **Part labels** — printable Code 128 bin labels (Avery 5160 layout) from any part; they scan on the Parts → Scan page.
- **Portal self-service** — customers keep their own email, phone and address current under *My account*.
- API keys are rate-limited to 600 requests/minute (HTTP 429 with a retry hint).
- **Sessions you can revoke** — changing or resetting a password (or *Sign out other devices* under My account) invalidates every other session for that login; admin password resets do the same.
- **Ops** — the admin console's Ops page shows every scheduled job's last run and failures, the outbox queue, feeds with errors, webhook failures and which providers are configured; set `OPS_WEBHOOK_URL` (Slack/Discord) to be alerted on job failures and unhandled request errors.
- **Onboarding checklist** — new shops see a ten-step setup checklist on the dashboard for their first three weeks.

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

### Press shop production (metal stamping)

Pick the **Metal stamping & press parts** business type and three modules appear — **Jobs**, **Tooling**, **Shipments** — on top of the live production floor:

- **Products** (Parts → Products): the parts you make — your part number, the customer and their part number, the die and default press, the coil/sheet **material** and material per piece, a standard rate (pcs/h), pack quantity, price and cost. Raw material is an inventory item of kind *Material* with its own unit (lb, ft…).
- **Jobs** (production orders): quantity, customer PO, due date, press and die. *Start* mounts the die, opens a run for the current shift and puts the press to RUNNING; **live `machine.count` events from that press land on the job, its run and the die's hit counter**; manual counts and downtime reasons can be added; the job **auto-completes at the order quantity**, books good pieces into finished-goods stock, consumes material and frees the press. Progress, scrap %, rate vs standard and ETA are on the job page.
- **Tooling**: dies with hit counts fed by the presses, service intervals (sharpen every N hits), where each die is mounted, the products it makes, and a one-click *Record service* that resets the interval; dies past their interval flip to *maintenance* automatically.
- **Shipments**: pick a customer, ship pieces from complete jobs and finished-goods stock, print a **packing slip**, mark shipped (stock leaves), then **Create invoice** — a goods invoice with the same pay link and portal flow as service invoices.
- **Shift & OEE report** (Production → Shift & OEE): per press per day — run time vs planned shift time, good/scrap, availability × performance × quality = OEE, output by shift, downtime reasons. Shifts are set under Settings → Rates & hours.

- **Dashboards for the press shop**: owners see presses running / down, pieces and scrap today, OEE, late jobs, pieces ready to ship, open invoices, the live floor, jobs on the floor, dies due, low coil and this week's shipments. Operators (technician role) get a **press station**: every press with its job, big good/scrap/rate counters, Pause with a reason, Resume, manual counts, and the released queue with one-tap Start.
- **Press plan** (Jobs → Press plan): every open job queued per press in priority order with hours from remaining pieces ÷ standard rate and a projected finish against the due date — late ones in red.
- **B2B customer portal**: a manufacturing shop's customers sign in to see open orders with live progress, shipments with tracking, invoices with pay links, their part numbers and stock, and completed orders — instead of vehicles.
- **Tooling work orders**: *Open tooling work order* on a die sends it to the tool room as a work order (parts, labor, history) on the die's own asset record; the die shows *maintenance* until it's done.
- **Quality checks**: each product carries a **check plan** (features with nominal ± tolerance, or pass/fail items like burr and finish), a drawing revision and an in-process check interval. Jobs then get a **first-piece check** (the job page and press station nag until it's approved), **in-process checks** every N pieces and a **final check**. The inspector types the actuals on a tablet-sized sheet; the result is worked out against the plan. A **fail puts the job on quality hold** — the run closes, the press goes idle, *Start/Resume* is refused until a passing check (or a manager releases the hold with a note). Managers see a *Needs an inspector* list on the dashboard.
- **Scrap reasons**: scrap is logged with a reason (burr, split, dimension out, mis-feed, coil end…) from the job page, the press station or the counts form; feed counts without a reason show up as *unclassified*.
- **Material lots / coils** (Parts → Material lots): receive a coil or bundle by **lot and heat number** (supplier, mill cert on file, quantity) — it books into the material's stock. A job runs on a coil (*Coil / lot on the press*; *Change coil* closes the run and opens a new one on the new lot), so every run knows its steel; completing the job draws the material down across the lots it ran on, pro-rated by hits. The lot page shows the runs, jobs and shipments that came from that coil.
- **Shipping paperwork**: the packing slip lists lot / heat per line; **Certificate of Conformance** (part, revision, quantity, lots & heats, last inspection, signature block) and **carton labels** (4 × 3 in, one per carton from the pack quantity, Code 128 of the customer part number, qty, lot/heat, carton n of N) print from the shipment.
- **Production reports** (Production → Scrap & quality, or Jobs → Reports): over 7 / 30 / 90 days — scrap rate, **scrap Pareto by reason** (the first 80 % highlighted), scrap by die and by product, output by shift and press, checks passed / failed with the out-of-tolerance features, **on-time delivery** and late orders, plus the inspector queue.

The seed includes **Roswell Press & Stamping** (login `press@nexdrive.app`, feed key `nd_demo_roswellpress_feed_key`) with three presses, three dies, two B2B customers, coil lots with heat numbers, products with check plans, jobs with checks and scrap reasons, and a shipment.

### Machines ↔ maintenance

A machine on the live feed can be tied to an asset record (Production → machine → *Maintenance*): create the record from the machine or pick an existing one. From then on a **critical alarm opens a maintenance work order automatically** (one open job per machine, optional per machine), a `machine.reading` for the run-hours metric (`run_hours` by default, configurable) keeps the asset's counter current so **interval-based PM reminders fire from real run-hours**, *Open job* on the machine page creates a job by hand, and **completing the job releases the machine** from maintenance/down to idle with an event in its history. Jobs for in-house equipment bill to an internal "In-house" customer that is created on first use.

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

**Outbound webhooks** notify other software when things happen: `customer.created`, `vehicle.created`, `work_order.created / status_changed / sent_for_approval / approved / declined`, `invoice.created / paid`, `payment.recorded`, `appointment.created / status_changed / rescheduled`, `part.low_stock`, `machine.status_changed / alarm`. Each delivery is a JSON envelope `{ id, event, at, data }` signed with `X-NexDrive-Signature: sha256=HMAC_SHA256(secret, body)`; failures retry twice and every delivery is logged in Settings.

## Tests

```bash
npm test          # unit tests (money, CSV import mapping, templates, lanes, Stripe signatures, rate limit)
NEXDRIVE_URL=http://127.0.0.1:4500 NEXDRIVE_API_KEY=nd_live_… npm run test:smoke   # HTTP smoke against a running server
```

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
