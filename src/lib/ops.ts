import "server-only";
import { rawDb } from "./db";

/**
 * Operations helpers: every scheduled job is recorded in JobRun (visible on
 * /admin/ops) and failures are pushed to OPS_WEBHOOK_URL (Slack / Discord /
 * any JSON endpoint) when it is set.
 */
export async function opsAlert(title: string, detail?: string) {
  const url = process.env.OPS_WEBHOOK_URL;
  console.error(`[nexdrive] ${title}${detail ? ` — ${detail}` : ""}`);
  if (!url) return;
  const text = `⚠️ NexDrive: ${title}${detail ? `\n${detail.slice(0, 1500)}` : ""}`;
  try {
    // Slack ("text") and Discord ("content") both accept this shape
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, content: text }) });
  } catch {
    /* alerting must never take the app down */
  }
}

/** Run a scheduled job with timing, a JobRun row, and an alert on failure. */
export async function runJob(name: string, fn: () => Promise<number | void>) {
  const run = await rawDb.jobRun.create({ data: { name } });
  try {
    const n = await fn();
    await rawDb.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), ok: true, count: typeof n === "number" ? n : 0 } });
    if (typeof n === "number" && n > 0) console.log(`[nexdrive] ${name}: ${n}`);
    return n ?? 0;
  } catch (e) {
    const detail = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
    await rawDb.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), ok: false, detail: detail.slice(0, 4000) } }).catch(() => null);
    await opsAlert(`scheduled job "${name}" failed`, detail);
    return 0;
  }
}

/** Keep the job log to the last 30 days. */
export async function pruneJobRuns() {
  await rawDb.jobRun.deleteMany({ where: { startedAt: { lt: new Date(Date.now() - 30 * 86400_000) } } });
}
