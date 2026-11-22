import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createPlanScanner } from "./scanner";

const FIXTURES = path.resolve(import.meta.dirname, "../../../e2e/mocks/anthropic");

interface FixtureEvent {
  event: string;
  data: { type: string; delta?: { type: string; text?: string } };
}

/** The answer text of a recorded call (all text blocks, in order; fallback blocks carry none). */
function answerText(name: string, call = 0): string {
  const fixture = JSON.parse(readFileSync(path.join(FIXTURES, `${name}.json`), "utf8")) as { calls: { events: FixtureEvent[] }[] };
  return (fixture.calls[call]?.events ?? []).flatMap((event) => (event.data.delta?.type === "text_delta" ? [event.data.delta.text ?? ""] : [])).join("");
}

type Recorded = [string, unknown];

function scan(chunks: readonly string[]): Recorded[] {
  const events: Recorded[] = [];
  const scanner = createPlanScanner({
    onKind: (kind) => events.push(["kind", kind]),
    onTheme: (theme) => events.push(["theme", theme]),
    onProfile: (profile) => events.push(["profile", profile]),
    onBlock: (index, block) => events.push([`block ${String(index)}`, block]),
    onNotes: (notes) => events.push(["notes", notes]),
    onInvalid: (where, value) => events.push([`invalid ${where}`, value]),
  });
  for (const chunk of chunks) scanner.push(chunk);
  scanner.end();
  return events;
}

/** Deterministic chunk sizes (1–30 characters). */
function chunkings(text: string, seed: number): string[] {
  let state = seed;
  const chunks: string[] = [];
  for (let at = 0; at < text.length; ) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const size = 1 + (state % 30);
    chunks.push(text.slice(at, at + size));
    at += size;
  }
  return chunks;
}

describe("plan scanner", () => {
  it.each(["de-music", "ar-coach", "fallback"])("%s: every split into two pieces and random chunkings give the same events as one piece", (name) => {
    const text = answerText(name);
    const whole = scan([text]);
    expect(whole.map(([type]) => type)).toEqual(name === "ar-coach" ? ["kind", "theme", "profile", "block 0", "block 1", "block 2", "notes"] : ["kind", "theme", "profile", "block 0", "block 1", "block 2", "block 3", "notes"]);
    for (let at = 0; at <= text.length; at += 1) expect(scan([text.slice(0, at), text.slice(at)])).toEqual(whole);
    for (let seed = 1; seed <= 40; seed += 1) expect(scan(chunkings(text, seed))).toEqual(whole);
  });

  it("reads Arabic through \\u escapes and an escaped quote, even when a piece ends inside them", () => {
    const text = answerText("ar-coach");
    expect(text).toMatch(/\\u06/);
    expect(text).toContain('\\"');
    const profile = scan([text]).find(([type]) => type === "profile")?.[1] as { displayName: string; bio: string };
    expect(profile.displayName).toBe("سارة");
    expect(profile.bio).toContain('"خطوة أولى"');
    // One character at a time: every escape is cut.
    expect(scan(Array.from(text))).toEqual(scan([text]));
  });

  it("does not close anything on a brace or bracket inside a string, nor after an escaped backslash", () => {
    const plan = {
      kind: "music",
      theme: { template: "nocturne", accent: "template", pairing: "template", buttonShape: "template", buttonStyle: "template" },
      profile: { displayName: "Lio } ] {", tagline: 'a "quoted" word', bio: "C:\\ path\\", location: "" },
      blocks: [{ type: "text", text: "} ] { [ \\\" }" }],
      notes: [],
    };
    const text = JSON.stringify(plan);
    const events = scan(Array.from(text));
    expect(events.map(([type]) => type)).toEqual(["kind", "theme", "profile", "block 0", "notes"]);
    expect(events[2]?.[1]).toEqual(plan.profile);
    expect(events[3]?.[1]).toEqual(plan.blocks[0]);
  });

  it("reports a slice that breaks the schema (a title over its limit) as invalid, with its JSON", () => {
    const block = { type: "header", title: "x".repeat(81) };
    const events = scan([`{"kind":"music","blocks":[${JSON.stringify(block)}]`]);
    expect(events).toEqual([
      ["kind", "music"],
      ["invalid $.blocks[0]", block],
    ]);
  });

  it("stops quietly on a cut-off answer (nothing pending is reported)", () => {
    const text = answerText("max-tokens");
    const events = scan([text]);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every(([type]) => !type.startsWith("invalid"))).toBe(true);
  });
});
