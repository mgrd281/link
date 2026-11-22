import { describe, expect, it } from "vitest";

import type { AiRunEvent } from "./events";
import { createSseParser, readRunEvents, runEventOf, type SseFrame } from "./sse-client";

const encoder = new TextEncoder();

/** The server's frame format (`sse.ts`): an id, the event type, one line of JSON, a blank line. */
const frame = (id: number, event: AiRunEvent) => `id: ${String(id)}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

const EVENTS: AiRunEvent[] = [
  { type: "run", id: "run-1", plan: "free", left: 1 },
  { type: "step", key: "read", state: "start" },
  { type: "profile", profile: { displayName: "ليو فانس", tagline: "منسّق موسيقى في برلين ✨", bio: "Ich lege auf – überall." } },
  { type: "notes", notes: [{ topic: "copy", text: "العنوان «قصير» 🎧" }] },
  { type: "error", code: "busy", counted: false },
];

function parseAll(chunks: (string | Uint8Array)[]): SseFrame[] {
  const frames: SseFrame[] = [];
  const parser = createSseParser((found) => frames.push(found));
  for (const chunk of chunks) parser.push(chunk);
  parser.end();
  return frames;
}

describe("createSseParser", () => {
  const text = `: ping\n\n${EVENTS.map((event, index) => frame(index + 1, event)).join("")}: ping\n\n`;
  const bytes = encoder.encode(text);

  it("reads whole frames and skips comments (the 15 s ping)", () => {
    const frames = parseAll([text]);
    expect(frames.map((found) => found.event)).toEqual(EVENTS.map((event) => event.type));
    expect(frames.map((found) => found.id)).toEqual(["1", "2", "3", "4", "5"]);
    expect(frames.map((found) => runEventOf(found))).toEqual(EVENTS);
  });

  it("gives the same frames however the bytes are split, also inside a multi-byte character", () => {
    const expected = parseAll([bytes]);
    // Every single split point: inside "event:", inside the JSON, inside the blank line and inside
    // the bytes of Arabic letters, the guillemets and the emoji.
    for (let at = 1; at < bytes.length; at += 1) {
      expect(parseAll([bytes.slice(0, at), bytes.slice(at)])).toEqual(expected);
    }
    // And in 13-byte pieces, as the mock writes them, and one byte at a time.
    const pieces = (size: number) => Array.from({ length: Math.ceil(bytes.length / size) }, (_, i) => bytes.slice(i * size, (i + 1) * size));
    expect(parseAll(pieces(13))).toEqual(expected);
    expect(parseAll(pieces(1))).toEqual(expected);
  });

  it("splits a multi-byte character that arrives in two pieces correctly (no replacement characters)", () => {
    const arabic = encoder.encode(frame(1, EVENTS[2]!));
    // Cut inside the first Arabic letter (2 bytes in UTF-8).
    const cut = arabic.indexOf(0xd9) + 1;
    const frames = parseAll([arabic.slice(0, cut), arabic.slice(cut)]);
    expect(frames).toHaveLength(1);
    expect(frames[0]?.data).not.toContain("�");
    expect(runEventOf(frames[0]!)).toEqual(EVENTS[2]);
  });

  it("accepts CRLF line ends, several data lines and a last frame without its blank line", () => {
    const frames = parseAll(["event: step\r\ndata: {\"type\":\"step\",\r\n", "data: \"key\":\"read\",\"state\":\"done\"}\r\n\r\nevent: x\ndata: last"]);
    expect(frames).toEqual([
      { event: "step", data: '{"type":"step",\n"key":"read","state":"done"}', id: undefined },
      { event: "x", data: "last", id: undefined },
    ]);
  });

  it("ignores frames without data, unknown types and broken JSON", () => {
    expect(parseAll(["event: run\n\n"])).toEqual([]);
    expect(runEventOf({ event: "x", data: '{"type":"nonsense"}' })).toBeNull();
    expect(runEventOf({ event: "x", data: "{broken" })).toBeNull();
    expect(runEventOf({ event: "x", data: "null" })).toBeNull();
  });
});

describe("readRunEvents", () => {
  const stream = (chunks: Uint8Array[], fail = false) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        if (fail) controller.error(new Error("connection reset"));
        else controller.close();
      },
    });

  it("delivers every event and says the run ended at its terminal event", async () => {
    const got: AiRunEvent[] = [];
    const outcome = await readRunEvents(stream([encoder.encode(EVENTS.map((event, i) => frame(i + 1, event)).join(""))]), (event) => got.push(event));
    expect(outcome).toBe("ended");
    expect(got).toEqual(EVENTS);
  });

  it("says 'broken' when the stream stops (or fails) before a terminal event", async () => {
    const got: AiRunEvent[] = [];
    const partial = encoder.encode(EVENTS.slice(0, 2).map((event, i) => frame(i + 1, event)).join(""));
    expect(await readRunEvents(stream([partial]), (event) => got.push(event))).toBe("broken");
    expect(got).toHaveLength(2);
    expect(await readRunEvents(stream([partial], true), () => undefined)).toBe("broken");
  });
});
