import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import type { OrderEvent } from "./orders-data";
import { partialRefund, teamEditorMessages } from "./team-words";

const LOCALES = { de, en, ar };

describe("the proposal editor's empty state", () => {
  it.each(Object.entries(LOCALES))("%s: speaks to the team member, not to the customer", (_, messages) => {
    const team = teamEditorMessages(messages);
    expect(team.app.editor.emptyTitle).toBe(messages.admin.orders.editor.emptyTitle);
    expect(team.app.editor.emptyBody).toBe(messages.admin.orders.editor.emptyBody);
    // The customer's own editor keeps its words.
    expect(team.app.editor.emptyTitle).not.toBe(messages.app.editor.emptyTitle);
    expect(team.app.editor.emptyBody).not.toBe(messages.app.editor.emptyBody);
    expect(messages.app.editor.emptyTitle).not.toBe("");
  });

  it("names the proposal and the briefing, and never 'your page'", () => {
    const words = (messages: typeof de) => `${messages.admin.orders.editor.emptyTitle} ${messages.admin.orders.editor.emptyBody}`;
    expect(words(de)).toMatch(/Vorschlag/);
    expect(words(de)).toMatch(/Briefing/);
    expect(words(de)).not.toMatch(/dein(e|er|en|em)? Seite|deinen ersten|deinen Shop/i);
    expect(words(en)).toMatch(/proposal/);
    expect(words(en)).not.toMatch(/your (page|first|shop)/i);
    expect(words(ar)).toMatch(/الاقتراح/);
    expect(words(ar)).not.toMatch(/صفحتك|متجرك/);
  });

  it("changes nothing else and does not touch the page's messages", () => {
    const before = JSON.stringify(de);
    const team = teamEditorMessages(de);
    expect(JSON.stringify(de)).toBe(before);
    const { emptyTitle: _title, emptyBody: _body, ...rest } = team.app.editor;
    const { emptyTitle: _oldTitle, emptyBody: _oldBody, ...original } = de.app.editor;
    expect(rest).toEqual(original);
    expect(team.admin).toBe(de.admin);
    expect({ ...team, app: null }).toEqual({ ...de, app: null });
  });

  it("keeps the customer's words when the team's are missing", () => {
    const bare = { app: { editor: { emptyTitle: "A", emptyBody: "B", blocks: "C" } } };
    expect(teamEditorMessages(bare)).toEqual(bare);
  });
});

describe("a partial refund in the timeline", () => {
  const event = (kind: string, details: Record<string, unknown>): OrderEvent => ({ id: 1, at: "2026-11-23T10:00:00Z", kind, actor: null, details });

  it("is told apart from a refund that ended the order", () => {
    expect(partialRefund(event("refunded", { amount: 500, kind: "goodwill", partial: true }))).toEqual({ amountCents: 500 });
    expect(partialRefund(event("refunded", { amount: 2499, kind: "voluntary" }))).toBeNull();
    expect(partialRefund(event("refunded", { amount: null, kind: "withdrawal" }))).toBeNull();
    expect(partialRefund(event("note", { amount: 500, partial: true }))).toBeNull();
    expect(partialRefund(event("refunded", { partial: true }))).toBeNull();
  });

  it.each(Object.entries(LOCALES))("%s: has its own words with the amount", (_, messages) => {
    expect(messages.admin.orders.events.refunded_partial).toContain("{amount}");
    expect(messages.admin.orders.events.refunded_partial).not.toBe(messages.admin.orders.events.refunded);
  });
});
