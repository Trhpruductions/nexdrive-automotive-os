"use client";

import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={disabled || pending}>
      <Send size={15} /> {pending ? "Thinking…" : "Ask"}
    </button>
  );
}

export function AskForm({ action, disabled }: { action: (formData: FormData) => Promise<void>; disabled: boolean }) {
  return (
    <form action={action} className="border-t border-border p-3 flex gap-2">
      <input name="question" required autoFocus disabled={disabled} placeholder={disabled ? "Add ANTHROPIC_API_KEY to enable" : "Ask NexDrive AI… (e.g. create an estimate for a brake job on John Smith's Mustang)"} className="input flex-1" autoComplete="off" />
      <SubmitButton disabled={disabled} />
    </form>
  );
}
