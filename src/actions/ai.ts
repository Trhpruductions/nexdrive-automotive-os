"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { aiEnabled, runAssistant } from "@/lib/ai";

export async function askAssistant(formData: FormData) {
  const user = await requireStaff();
  const question = String(formData.get("question") ?? "").trim();
  if (!question) redirect("/ai");
  if (!aiEnabled()) redirect("/ai?error=Add+ANTHROPIC_API_KEY+to+.env+and+restart+to+enable+NexDrive+AI");

  const history = await db.aiMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, take: 40 });
  await db.aiMessage.create({ data: { userId: user.id, role: "user", content: question } });
  let answer: string;
  try {
    answer = await runAssistant(user, history.map((m) => ({ role: m.role, content: m.content })), question);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) answer = "The ANTHROPIC_API_KEY in .env was rejected. Check the key and restart the server.";
    else if (e instanceof Anthropic.RateLimitError) answer = "The AI service is rate-limited right now — try again in a moment.";
    else if (e instanceof Anthropic.APIError) answer = `The AI service returned an error (${e.status}): ${e.message}`;
    else answer = `Something went wrong: ${e instanceof Error ? e.message : String(e)}`;
  }
  await db.aiMessage.create({ data: { userId: user.id, role: "assistant", content: answer } });
  revalidatePath("/ai");
  redirect("/ai");
}

export async function clearAssistant() {
  const user = await requireStaff();
  await db.aiMessage.deleteMany({ where: { userId: user.id } });
  revalidatePath("/ai");
  redirect("/ai");
}
