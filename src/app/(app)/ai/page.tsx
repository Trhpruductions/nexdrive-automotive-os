import { Bot, Sparkles, Trash2 } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { aiEnabled } from "@/lib/ai";
import { Card, Flash, PageHeader } from "@/components/ui";
import { askAssistant, clearAssistant } from "@/actions/ai";
import { fmtRelative, initials } from "@/lib/format";
import { AskForm } from "./ask-form";
import { Markdown } from "./markdown";

export const metadata = { title: "NexDrive AI" };

const SUGGESTIONS = [
  "Summarize today's shop activity",
  "Which work orders are waiting for customer approval?",
  "Show me vehicles that are overdue for service",
  "Find customers who haven't returned in 12 months",
  "What parts are low on stock and who supplies them?",
  "How did revenue this week compare to last week?",
  "What's running on the production floor right now?",
];

export default async function AiPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireStaff();
  const settings = await getSettings();
  const sp = await searchParams;
  const messages = await db.aiMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, take: 60 });
  const enabled = aiEnabled();

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={<span className="flex items-center gap-2"><Sparkles size={20} className="text-accent" /> NexDrive AI</span>}
        subtitle={`Ask anything about ${settings.name} — it reads your live work orders, customers, schedule, inventory, revenue and production data.`}
        actions={messages.length ? <form action={clearAssistant}><button className="btn btn-ghost"><Trash2 size={15} /> Clear</button></form> : null}
      />
      <Flash searchParams={sp} />
      {!enabled ? (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          NexDrive AI is not configured yet. Add <code>ANTHROPIC_API_KEY=…</code> to <code>D:\NexDrive\.env</code> and restart the server. Everything else in the OS works without it.
        </div>
      ) : null}

      <Card padded={false}>
        <div className="p-5 space-y-5 min-h-[40vh] max-h-[62vh] overflow-y-auto">
          {!messages.length ? (
            <div className="text-center py-8">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-accent-soft text-accent grid place-items-center"><Bot size={28} /></div>
              <p className="mt-3 font-medium">What do you want to know?</p>
              <p className="text-sm text-muted mt-1">Try one of these, or type your own question below.</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {SUGGESTIONS.map((s) => (
                  <form key={s} action={askAssistant}>
                    <input type="hidden" name="question" value={s} />
                    <button className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:text-text hover:border-border-strong" disabled={!enabled}>{s}</button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" ? <span className="h-8 w-8 rounded-lg bg-accent-soft text-accent grid place-items-center shrink-0"><Bot size={16} /></span> : null}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-accent text-white rounded-br-sm" : "bg-bg-elevated border border-border rounded-bl-sm"}`}>
                {m.role === "assistant" ? <Markdown text={m.content} /> : <div className="whitespace-pre-line">{m.content}</div>}
                <div className={`text-[10px] mt-1.5 ${m.role === "user" ? "text-white/70" : "text-faint"}`}>{fmtRelative(m.createdAt)}</div>
              </div>
              {m.role === "user" ? <span className="h-8 w-8 rounded-full bg-gradient-to-br from-accent to-violet-500 grid place-items-center text-[11px] font-bold text-white shrink-0">{initials(user.name)}</span> : null}
            </div>
          ))}
        </div>
        <AskForm action={askAssistant} disabled={!enabled} />
      </Card>
      <p className="text-xs text-faint mt-3">NexDrive AI can read shop data and, when asked, draft estimates. It never sends customer data anywhere except the Claude API request for your question.</p>
    </div>
  );
}
