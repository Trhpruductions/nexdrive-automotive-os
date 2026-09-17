import { EventEmitter } from "node:events";

// In-process event bus: ingestion → live SSE stream. Cached on globalThis so
// `next dev` hot reloads don't create a second, disconnected emitter.
const g = globalThis as unknown as { __ndBus?: EventEmitter };
export const bus: EventEmitter = g.__ndBus ?? (g.__ndBus = new EventEmitter());
bus.setMaxListeners(200);

export type ChangeEvent = { machines: string[]; parts: string[] };
