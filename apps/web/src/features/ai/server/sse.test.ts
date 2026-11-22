import { afterEach, describe, expect, it, vi } from "vitest";

import { createSseSink } from "./sse";

const decoder = new TextDecoder();

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  let text = "";
  for await (const chunk of stream) text += decoder.decode(chunk, { stream: true });
  return text;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("SSE sink", () => {
  it("writes numbered frames with the event type and JSON data", async () => {
    const sink = createSseSink();
    sink.emit({ type: "run", id: "r1", plan: "free", left: 1 });
    sink.emit({ type: "step", key: "read", state: "start" });
    sink.close();
    expect(await readAll(sink.stream)).toBe(
      'id: 1\nevent: run\ndata: {"type":"run","id":"r1","plan":"free","left":1}\n\nid: 2\nevent: step\ndata: {"type":"step","key":"read","state":"start"}\n\n',
    );
  });

  it("sends a ping comment every 15 s and stops it on close", async () => {
    vi.useFakeTimers();
    const sink = createSseSink();
    const reader = sink.stream.getReader();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(decoder.decode((await reader.read()).value)).toBe(": ping\n\n");
    sink.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never throws once the browser has gone: later events are dropped and the ping stops", async () => {
    vi.useFakeTimers();
    const sink = createSseSink();
    await sink.stream.cancel();
    expect(sink.closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(() => {
      sink.emit({ type: "step", key: "plan", state: "start" });
      sink.emit({ type: "error", code: "server", counted: false });
      sink.close();
    }).not.toThrow();
  });
});
