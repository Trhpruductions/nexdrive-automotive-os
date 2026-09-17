#!/usr/bin/env node
// Create (or reset) a NexDrive platform admin. Runs inside the container:
//   docker compose exec app node docker/create-admin.js you@example.com 'StrongPassword' 'Your Name'
// Uses pg + bcryptjs directly so it works from the pruned production image.
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const [email, password, name = "NexDrive Admin"] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error("usage: create-admin.js <email> <password (8+ chars)> [name]");
  process.exit(1);
}
const client = new Client({ connectionString: process.env.DATABASE_URL });
client
  .connect()
  .then(async () => {
    const hash = bcrypt.hashSync(password, 10);
    const id = "usr_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    const r = await client.query(
      `INSERT INTO "User" ("id","email","passwordHash","name","role","active","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,'SUPERADMIN',true,NOW(),NOW())
       ON CONFLICT ("email") DO UPDATE SET "passwordHash"=EXCLUDED."passwordHash", "role"='SUPERADMIN', "active"=true, "name"=EXCLUDED."name", "updatedAt"=NOW()
       RETURNING "id"`,
      [id, email.toLowerCase(), hash, name],
    );
    console.log(`platform admin ready: ${email.toLowerCase()} (${r.rows[0].id}) — sign in at /login`);
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => client.end());
