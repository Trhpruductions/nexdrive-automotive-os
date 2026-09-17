import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { bus } from "@/lib/integrations/bus";
import { productionSnapshot } from "@/lib/integrations/snapshot";

export const dynamic = "force-dynamic";

/**
 * GET /api/live — Server-Sent Events stream of the production floor snapshot.
 * Pushes on every ingested change (debounced) plus a heartbeat every 15s.
 */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role === "CUSTOMER") return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let closed = false;
  let timer: NodeJS.Timeout | null = null;
  let heartbeat: NodeJS.Timeout | null = null;
  let onChange: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        if (closed) return;
        try {
          const snap = await productionSnapshot();
          controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snap)}\n\n`));
        } catch (e) {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: e instanceof Error ? e.message : String(e) })}\n\n`));
        }
      };
      await send();
      onChange = () => {
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
          void send();
        }, 400);
      };
      bus.on("change", onChange);
      heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ping\n\n`));
        void send();
      }, 15_000);
    },
    cancel() {
      closed = true;
      if (onChange) bus.off("change", onChange);
      if (timer) clearTimeout(timer);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  req.signal.addEventListener("abort", () => {
    closed = true;
    if (onChange) bus.off("change", onChange);
    if (timer) clearTimeout(timer);
    if (heartbeat) clearInterval(heartbeat);
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
