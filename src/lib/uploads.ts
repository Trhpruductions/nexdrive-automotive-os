import "server-only";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

// Uploads live outside `public/` (var/uploads) and are served by /api/files/[...path]
// so files added at runtime work identically in dev and production.
export const UPLOAD_ROOT = path.join(process.cwd(), "var", "uploads");
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

export async function saveUpload(file: File, folder: string): Promise<string | null> {
  const ext = ALLOWED[file.type] ?? (file.name.match(/\.(jpe?g|png|webp|heic|gif|svg)$/i)?.[0].toLowerCase() ?? null);
  if (!ext || file.size > MAX_BYTES) return null;
  const safeFolder = folder.replace(/[^a-z0-9_-]/gi, "");
  const dir = path.join(UPLOAD_ROOT, safeFolder);
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/api/files/${safeFolder}/${name}`;
}

export async function readUpload(parts: string[]) {
  const rel = path.normalize(parts.join("/")).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(UPLOAD_ROOT, rel);
  if (!full.startsWith(UPLOAD_ROOT)) return null;
  try {
    const s = await stat(full);
    if (!s.isFile()) return null;
    const ext = path.extname(full).toLowerCase();
    const type = Object.entries(ALLOWED).find(([, e]) => e === ext || (ext === ".jpeg" && e === ".jpg"))?.[0] ?? "application/octet-stream";
    return { body: await readFile(full), type, size: s.size };
  } catch {
    return null;
  }
}
