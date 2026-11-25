import { gzipSync } from "node:zlib";

import type { AbstractIntlMessages } from "next-intl";
import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { CLIENT_NAMESPACES, clientMessages, pickMessages } from "./client-messages";

type Messages = Record<string, unknown>;
const CATALOGUES = { de, en, ar } as unknown as Record<"de" | "en" | "ar", AbstractIntlMessages>;
const DE = CATALOGUES.de;

const has = (messages: Messages, path: string): boolean => {
  let node: unknown = messages;
  for (const key of path.split(".")) {
    if (typeof node !== "object" || node === null || !Object.hasOwn(node, key)) return false;
    node = (node as Messages)[key];
  }
  return true;
};

describe("client messages per route group (E-03)", () => {
  const all = { a: { x: "1", y: { z: "2" } }, b: { w: "3" }, c: "4" };

  it("picks namespaces and paths, all with `*`, and leaves out `!` paths in order", () => {
    expect(pickMessages(all, ["a.y", "c"])).toEqual({ a: { y: { z: "2" } }, c: "4" });
    expect(pickMessages(all, ["*", "!a.y", "!b"])).toEqual({ a: { x: "1" }, c: "4" });
    expect(pickMessages(all, ["!a", "a.x"])).toEqual({ a: { x: "1" } });
    expect(pickMessages(all, ["missing", "a.missing"])).toEqual({});
  });

  it("copies what it picks, so a group never shares objects with the catalogue", () => {
    const picked = pickMessages(all, ["a"]) as { a: { y: { z: string } } };
    picked.a.y.z = "changed";
    expect(all.a.y.z).toBe("2");
  });

  it("names only messages that exist, in all three languages", () => {
    for (const [group, entries] of Object.entries(CLIENT_NAMESPACES)) {
      for (const entry of entries) {
        if (entry === "*") continue;
        const path = entry.replace(/^!/, "");
        for (const [locale, messages] of Object.entries(CATALOGUES)) expect(has(messages, path), `${group}: ${entry} in ${locale}`).toBe(true);
      }
    }
  });

  it("gives the sign-up, legal and checkout pages the site's words and their own", () => {
    for (const group of ["auth", "legal", "checkout"] as const) {
      expect(CLIENT_NAMESPACES[group].slice(0, CLIENT_NAMESPACES.site.length)).toEqual([...CLIENT_NAMESPACES.site]);
    }
    expect(has(clientMessages(DE, "auth"), "auth.errors")).toBe(true);
    expect(has(clientMessages(DE, "legal"), "legal.cancel")).toBe(true);
    expect(has(clientMessages(DE, "checkout"), "checkout.done")).toBe(true);
  });

  it("keeps the website's words small: they travel inside every page's HTML (ADR 0008)", () => {
    const site = clientMessages(DE, "site");
    // What only other areas read stays out: sign-up, legal texts, checkout, the team console, e-mails.
    for (const namespace of ["auth", "legal", "checkout", "service", "admin", "email", "ui", "design"]) expect(has(site, namespace), namespace).toBe(false);
    for (const locale of ["de", "en", "ar"] as const) {
      const size = gzipSync(JSON.stringify(clientMessages(CATALOGUES[locale], "site"))).length;
      expect(size, `site words in ${locale}: ${String(size)} bytes gzip`).toBeLessThan(12_000);
    }
  });

  it("gives creator pages their islands' words and not the portfolio's server-rendered ones", () => {
    const creator = clientMessages(DE, "creator");
    expect(has(creator, "creator.portfolio.viewer")).toBe(true);
    expect(has(creator, "creator.privacyAllow")).toBe(true);
    expect(has(creator, "marketing")).toBe(false);
    expect(Object.keys((creator as { creator: { portfolio: Messages } }).creator.portfolio).length).toBeLessThan(
      Object.keys((DE as { creator: { portfolio: Messages } }).creator.portfolio).length,
    );
  });
});
