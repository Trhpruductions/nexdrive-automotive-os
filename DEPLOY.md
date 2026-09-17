# Deploying NexDrive Automotive OS

NexDrive is a single Node.js service (Next.js) plus PostgreSQL. It runs anywhere Docker runs — a $10–20/month VPS is plenty for many shops — or on any platform that can run a Node app against a Postgres database.

## Option A — Docker Compose on a server (recommended)

Works on any Linux VPS (Hetzner, DigitalOcean, Linode, AWS Lightsail, a home server with a static IP…).

1. **Point a domain** at the server (`A` record, e.g. `app.nexdrive.example → 203.0.113.10`). Ports 80 and 443 must be open.
2. **Install Docker** (`curl -fsSL https://get.docker.com | sh`) and clone the repo:
   ```bash
   git clone https://github.com/Trhpruductions/nexdrive-automotive-os.git /opt/nexdrive && cd /opt/nexdrive
   ```
3. **Configure**:
   ```bash
   cp .env.example .env
   nano .env      # DOMAIN, APP_URL, POSTGRES_PASSWORD, AUTH_SECRET (+ optional provider keys)
   ```
   Generate strong secrets with `openssl rand -base64 32`.
4. **Start**:
   ```bash
   docker compose up -d --build
   docker compose logs -f app     # wait for "[nexdrive] starting on port 3000"
   ```
   Caddy obtains a Let's Encrypt certificate automatically; the site is live at `https://<DOMAIN>`.
5. **Create the first platform admin** (one time). The database starts empty — no demo data in production:
   ```bash
   docker compose exec app node docker/create-admin.js you@nexdrive.example 'StrongPassword123' 'Your Name'
   ```
   Sign in at `/login` → you land on `/admin`, where you create shops (or let shops self-serve at `/signup`).

**Updates**: `git pull && docker compose up -d --build` — migrations run automatically on start.

**Backups**: `docker/backup.sh` dumps the database and the uploads volume (keeps 30 days); add it to cron. Restore with `docker/restore.sh <dump> [uploads.tgz]`.

**Without a domain yet**: comment out the `caddy` service in `docker-compose.yml`, add `ports: ["4500:3000"]` to `app`, set `APP_URL=http://<server-ip>:4500`.

## Option B — managed platforms

The image is a standard Next.js standalone build, so it also runs on Railway, Render, Fly.io, Coolify, Dokku, AWS App Runner, Azure Container Apps, Google Cloud Run, etc.:

- Build from the `Dockerfile`; expose port `3000`; health check `GET /api/health`.
- Provide a PostgreSQL database (the platform's managed Postgres, Neon, Supabase, RDS…) as `DATABASE_URL`.
- Set `AUTH_SECRET`, `APP_URL`, and optional provider keys.
- Mount a persistent disk at `/app/var/uploads` (or accept that photos/logos are lost on redeploy — a future release can move uploads to S3).
- The entrypoint runs `prisma migrate deploy` on every start, so deploys are zero-touch.

Serverless platforms that spin down (Vercel, etc.) work for the app itself but will not keep MQTT subscriptions / pollers alive — production-floor feeds need an always-on container.

## Option C — plain Node on a server

```bash
npm ci && npx prisma generate && npx next build
DATABASE_URL=… AUTH_SECRET=… APP_URL=… PORT=3000 node .next/standalone/server.js
```
Copy `.next/static` to `.next/standalone/.next/static` and `public` to `.next/standalone/public` first (the Dockerfile shows the exact layout). Run `npx prisma migrate deploy` before starting, and put Caddy or nginx in front for HTTPS.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes | signs sessions (32+ random chars); rotating it signs everyone out |
| `APP_URL` | yes | public base URL used in customer approval links / notifications |
| `ANTHROPIC_API_KEY` | no | enables NexDrive AI |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | email delivery via Resend — notifications and password-reset links (otherwise emails stay queued and reset links are printed to the server log) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | no | email delivery via plain SMTP instead of Resend |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | no | SMS delivery |
| `NEXDRIVE_DISABLE_INTEGRATIONS` | no | `1` skips starting MQTT/pollers and the reminder scheduler (for one-off jobs) |

Card payments (Stripe) are configured per shop under Settings → Payments, not by environment variables — each shop uses its own Stripe account and webhook endpoint `/api/stripe/webhook/{shopId}`.

## Sizing & operations

- A shop of 4–6 technicians runs comfortably on 1 vCPU / 2 GB RAM with the bundled Postgres. Dozens of shops on one install: 2–4 vCPU / 4–8 GB and a managed Postgres.
- Machines that stop reporting are marked offline after 5 minutes; pollers re-sync their configuration every 30 seconds.
- `GET /api/health` returns `{ ok, db }` for load balancers and uptime monitors.
- Logs go to stdout (`docker compose logs app`).
- The multi-shop isolation layer is enforced in code (`src/lib/db.ts`); the database itself holds all shops in one schema.
