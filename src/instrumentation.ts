// Runs once when the Next.js server boots (Node runtime only): starts the
// MQTT subscribers and REST/CSV pollers configured under Settings → Integrations.
/** Next.js calls this for unhandled errors in requests, actions and route handlers. */
export async function onRequestError(err: unknown, request: { path: string; method: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { opsAlert } = await import("./lib/ops");
  const e = err as { message?: string; digest?: string };
  await opsAlert(`request error ${request.method} ${request.path}`, `${e?.message ?? String(err)}${e?.digest ? ` (digest ${e.digest})` : ""}`);
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXDRIVE_DISABLE_INTEGRATIONS === "1") return;
  const { startIntegrationRuntime } = await import("./lib/integrations/runtime");
  await startIntegrationRuntime();
  const { startReminderScheduler } = await import("./lib/reminders");
  startReminderScheduler();
}
