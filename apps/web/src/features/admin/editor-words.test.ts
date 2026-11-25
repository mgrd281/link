import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { OTHERS_PAGE_WORDS, othersPageMessages } from "./editor-words";

const LOCALES = { de, en, ar };

/** Words that speak to the page's owner: "dein…", "your", "…ك" (yours) in Arabic. */
const OWNER_VOICE = { de: /\bdein(e|er|en|em|es)?\b/i, en: /\byours?\b/i, ar: /صفحتك|متجرك|رابط لك/ };

describe("the team area's editor of someone else's page (K5)", () => {
  it.each(Object.entries(LOCALES))("%s: its empty state reads about this page, in the team area's words", (_, messages) => {
    const team = othersPageMessages(messages);
    for (const key of OTHERS_PAGE_WORDS) expect(team.app.editor[key], key).toBe(messages.admin.editor[key]);
    // The title and the text spoke to the owner; they are the team's words now.
    expect(team.app.editor.emptyTitle).not.toBe(messages.app.editor.emptyTitle);
    expect(team.app.editor.emptyBody).not.toBe(messages.app.editor.emptyBody);
  });

  it.each(Object.entries(LOCALES))("%s: never speaks to the page's owner", (locale, messages) => {
    const words = OTHERS_PAGE_WORDS.map((key) => messages.admin.editor[key]).join(" ");
    expect(words).not.toMatch(OWNER_VOICE[locale as keyof typeof OWNER_VOICE]);
    // The owner's own editor does (so the rule above is a real one), and keeps its words.
    expect(`${messages.app.editor.emptyTitle} ${messages.app.editor.emptyBody}`).toMatch(OWNER_VOICE[locale as keyof typeof OWNER_VOICE]);
  });

  it("has the same words in German, English and Arabic, none empty", () => {
    for (const messages of Object.values(LOCALES)) {
      expect(Object.keys(messages.admin.editor).sort()).toEqual([...OTHERS_PAGE_WORDS].sort());
      for (const key of OTHERS_PAGE_WORDS) expect(messages.admin.editor[key].trim(), key).not.toBe("");
    }
  });

  it("changes nothing else and does not touch the messages passed in", () => {
    const before = JSON.stringify(de);
    const team = othersPageMessages(de);
    expect(JSON.stringify(de)).toBe(before);
    const { emptyTitle: _t, emptyBody: _b, addFirst: _a, ...rest } = team.app.editor;
    const { emptyTitle: _ot, emptyBody: _ob, addFirst: _oa, ...original } = de.app.editor;
    expect(rest).toEqual(original);
    expect(team.admin).toBe(de.admin);
    expect({ ...team, app: null }).toEqual({ ...de, app: null });
  });

  it("keeps the owner's words where the team's are missing", () => {
    const bare = { app: { editor: { emptyTitle: "A", emptyBody: "B", addFirst: "C", blocks: "D" } } };
    expect(othersPageMessages(bare)).toEqual(bare);
  });

  it("covers every word of the editor's empty state, and the team area's shell hands them down", () => {
    // The empty branch of the editor (editor-screen.tsx) reads only the words this replaces.
    const editor = readFileSync(path.join(import.meta.dirname, "../app/editor-screen.tsx"), "utf8");
    const branch = editor.slice(editor.indexOf(") : empty ? ("), editor.indexOf(") : (", editor.indexOf(") : empty ? (")));
    const keys = [...branch.matchAll(/\bt\("([A-Za-z]+)"\)/g)].map((match) => match[1]);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(OTHERS_PAGE_WORDS as readonly string[], key).toContain(key);
    // Every screen of the team area, and so every editor in it, gets these messages.
    const shell = readFileSync(path.join(import.meta.dirname, "shell.tsx"), "utf8");
    expect(shell).toMatch(/othersPageMessages\(/);
    expect(shell).toMatch(/<NextIntlClientProvider[^>]*messages=/);
  });
});
