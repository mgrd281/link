import type { AiRunEvent } from "../events";

/**
 * Server-sent events for one run. Delivery never decides the run: `emit` never throws, and once the
 * browser goes away (the stream is cancelled) later events are dropped while the run carries on and
 * saves its result, which a reconnecting or polling client then reads from the database.
 *
 * Frames: `id: <n>`, `event: <type>`, `data: <json>`; a `: ping` comment every 15 s keeps proxies
 * from closing a quiet stream (the model can plan for a minute without a word).
 */

export interface SseSink {
  stream: ReadableStream<Uint8Array>;
  emit: (event: AiRunEvent) => void;
  close: () => void;
  /** True once the browser cancelled the stream or `close` ran. */
  readonly closed: boolean;
}

export const PING_MS = 15_000;

export function createSseSink(options: { pingMs?: number } = {}): SseSink {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  let sequence = 0;
  let ping: ReturnType<typeof setInterval> | undefined;

  const stop = () => {
    closed = true;
    if (ping !== undefined) clearInterval(ping);
    ping = undefined;
  };

  const write = (text: string) => {
    if (closed || !controller) return;
    try {
      controller.enqueue(encoder.encode(text));
    } catch {
      stop();
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(started) {
      controller = started;
      ping = setInterval(() => {
        write(": ping\n\n");
      }, options.pingMs ?? PING_MS);
    },
    cancel() {
      stop();
    },
  });

  return {
    stream,
    emit(event) {
      sequence += 1;
      let data: string;
      try {
        data = JSON.stringify(event);
      } catch {
        return;
      }
      write(`id: ${String(sequence)}\nevent: ${event.type}\ndata: ${data}\n\n`);
    },
    close() {
      if (closed) return;
      stop();
      try {
        controller?.close();
      } catch {
        // Already cancelled by the browser.
      }
    },
    get closed() {
      return closed;
    },
  };
}
