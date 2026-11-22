import type { AiRunEvent, AiRunEventType } from "./events";

/**
 * Reads the server-sent events of an AI run (`text/event-stream`). Pure, no `EventSource` (that one
 * cannot POST or send the Authorization header): bytes go in as they arrive, whole frames come out.
 *
 * - A frame ends at a blank line; a frame split across network chunks waits for its end.
 * - Bytes are decoded as a stream, so a character split between two chunks (Arabic text, an emoji)
 *   arrives whole.
 * - Comment lines (`: ping`, the server's keep-alive every 15 s) and frames without data are skipped.
 */

export interface SseFrame {
  event: string;
  data: string;
  id?: string | undefined;
}

export interface SseParser {
  push(chunk: Uint8Array | string): void;
  /** The stream ended: a last frame without its blank line is still delivered. */
  end(): void;
}

function parseFrame(block: string): SseFrame | null {
  let event = "message";
  let id: string | undefined;
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line === "" || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    // One space after the colon belongs to the syntax, not to the value.
    const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    else if (field === "id") id = value;
  }
  return data.length > 0 ? { event, data: data.join("\n"), id } : null;
}

export function createSseParser(onFrame: (frame: SseFrame) => void): SseParser {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const drain = (final: boolean) => {
    // CRLF and CR are line ends too; a CR at the very end may be half of a CRLF, so it waits.
    const keepCr = !final && buffer.endsWith("\r");
    const text = (keepCr ? buffer.slice(0, -1) : buffer).replace(/\r\n?/g, "\n");
    const blocks = text.split("\n\n");
    buffer = (final ? "" : (blocks.pop() ?? "")) + (keepCr ? "\r" : "");
    for (const block of blocks) {
      const frame = parseFrame(block);
      if (frame) onFrame(frame);
    }
  };
  return {
    push(chunk) {
      buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      drain(false);
    },
    end() {
      buffer += decoder.decode();
      drain(true);
    },
  };
}

const EVENT_TYPES: readonly AiRunEventType[] = ["run", "step", "source", "look", "profile", "block", "drop", "notes", "done", "stopped", "error"];

/** A frame as a run event, or null when it is not one (unknown type, broken JSON). */
export function runEventOf(frame: SseFrame): AiRunEvent | null {
  try {
    const value = JSON.parse(frame.data) as { type?: unknown } | null;
    if (!value || typeof value !== "object" || typeof value.type !== "string") return null;
    if (!(EVENT_TYPES as readonly string[]).includes(value.type)) return null;
    return value as AiRunEvent;
  } catch {
    return null;
  }
}

/** The run ended with this event (nothing follows it). */
export const isTerminal = (event: AiRunEvent): boolean => event.type === "done" || event.type === "stopped" || event.type === "error";

/**
 * Reads a response body to its end, calling `onEvent` for every run event. Answers "ended" when a
 * terminal event arrived, "broken" when the stream stopped before one (a dropped connection).
 */
export async function readRunEvents(body: ReadableStream<Uint8Array>, onEvent: (event: AiRunEvent) => void): Promise<"ended" | "broken"> {
  const seen = { terminal: false };
  const parser = createSseParser((frame) => {
    const event = runEventOf(frame);
    if (!event) return;
    if (isTerminal(event)) seen.terminal = true;
    onEvent(event);
  });
  const reader = body.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.push(value);
    }
    parser.end();
  } catch {
    // A dropped connection: whatever arrived was delivered; the caller falls back to polling.
  } finally {
    reader.releaseLock();
  }
  return seen.terminal ? "ended" : "broken";
}
