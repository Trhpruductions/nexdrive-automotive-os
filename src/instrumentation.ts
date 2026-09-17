// Runs once when the Next.js server boots (Node runtime only): starts the
// MQTT subscribers and REST/CSV pollers configured under Settings → Integrations.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXDRIVE_DISABLE_INTEGRATIONS === "1") return;
  const { startIntegrationRuntime } = await import("./lib/integrations/runtime");
  await startIntegrationRuntime();
  const { startReminderScheduler } = await import("./lib/reminders");
  startReminderScheduler();
}
