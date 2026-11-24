import { readFileSync } from "node:fs";
import path from "node:path";

import { isDirectional } from "@linkyo/ui";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { describe, expect, it } from "vitest";

/**
 * Texts and marks the review asked for, checked where they are written: the message files and the
 * components that show them (unit tests here run without a browser; e2e/stub-app.spec.ts opens the
 * same screens).
 */

const LOCALES = ["de", "en", "ar"] as const;
const root = path.resolve(import.meta.dirname, "../../..");
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

interface Messages {
  auth: { signup: { terms: string } };
  app: { settings: { rows: Record<string, string> }; orders: Record<string, unknown> & { briefing: Record<string, string> } };
  marketing: { pricing: { pro: { lead: string }; proLive: Record<string, unknown> & { lead: string } } };
}
const messages = (locale: string) => JSON.parse(source(`messages/${locale}.json`)) as Messages;

describe("Settings", () => {
  it("names the page's own legal notice and Linkyo's differently, in every language", () => {
    for (const locale of LOCALES) {
      const { rows } = messages(locale).app.settings;
      expect(rows.legal, locale).not.toBe(rows.imprint);
      // Linkyo's row says whose it is.
      expect(rows.imprint, locale).toContain("Linkyo");
      // No two rows of the screen share a name.
      const names = Object.values(rows);
      expect(new Set(names).size, locale).toBe(names.length);
    }
    const screen = source("features/app/settings-screen.tsx");
    expect(screen).toContain('title={t("rows.legal")}');
    expect(screen).toContain('title={t("rows.imprint")} href="/impressum"');
  });
});

describe("the sign-up consent sentence", () => {
  it("marks the terms and the privacy policy as links in every language", () => {
    for (const locale of LOCALES) {
      const sentence = messages(locale).auth.signup.terms;
      expect(sentence, locale).toMatch(/<terms>[^<]+<\/terms>/);
      expect(sentence, locale).toMatch(/<privacy>[^<]+<\/privacy>/);
    }
  });

  it("opens them in a new tab (the form keeps its input), marked by colour and weight, never a line", () => {
    const form = source("features/account/auth/signup-form.tsx");
    const link = /function LegalWord[\s\S]*?\n}\n/.exec(form)?.[0] ?? "";
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener"');
    expect(link).toContain("font-semibold text-link");
    expect(link).not.toMatch(/underline|decoration-/);
    expect(form).toContain('<LegalWord href="/agb" locale={locale}>');
    expect(form).toContain('<LegalWord href="/datenschutz" locale={locale}>');
  });
});

describe("the Pro card that can be bought", () => {
  it("leads with what Pro holds today, not with the coming-soon card's promise to sell and grow", () => {
    const card = /function ProLive\(\)[\s\S]*?\n}\n/.exec(source("features/marketing/sections.tsx"))?.[0] ?? "";
    expect(card).toContain('t("proLive.lead")');
    expect(card).not.toContain('t("pro.lead")');
    for (const locale of LOCALES) {
      const { pro, proLive } = messages(locale).marketing.pricing;
      expect(proLive.lead, locale).toEqual(expect.any(String));
      expect(proLive.lead, locale).not.toBe(pro.lead);
    }
    // Selling is planned, not shipped: the lead of the buyable card does not name it.
    expect(messages("de").marketing.pricing.proLive.lead).not.toMatch(/verkauf|wachs/i);
    expect(messages("en").marketing.pricing.proLive.lead).not.toMatch(/sell|grow/i);
    expect(messages("ar").marketing.pricing.proLive.lead).not.toMatch(/يبيع|بيع|ينمو/);
  });
});

describe("the order screen", () => {
  it("has its new sentences in every language", () => {
    for (const locale of LOCALES) {
      const { orders } = messages(locale).app;
      for (const key of ["withdrawalPending", "ended"]) expect(orders[key], `${locale} ${key}`).toEqual(expect.any(String));
      for (const key of ["empty", "tooManyLinks", "photosSkipped", "linksHint"]) expect(orders.briefing[key], `${locale} ${key}`).toEqual(expect.any(String));
      expect(orders.briefing.linksHint, locale).toContain("20");
      expect(orders.briefing.tooManyLinks, locale).toContain("{max}");
      expect(orders.briefing.photosSkipped, locale).toContain("{count, plural,");
    }
  });

  it("mirrors every arrow in a right-to-left screen", () => {
    // Icon mirrors these glyphs itself (DIRECTIONAL); a hand-written flip on top would undo it.
    for (const glyph of [ArrowLeft, ArrowRight, Send]) expect(isDirectional(glyph), glyph.displayName).toBe(true);
    for (const file of ["features/app/orders/order-screen.tsx", "features/app/orders/briefing-form.tsx"]) {
      const arrows = source(file).match(/<Icon icon=\{(?:ArrowLeft|ArrowRight|Send)\}[^>]*>/g) ?? [];
      expect(arrows.length, file).toBeGreaterThan(0);
      for (const arrow of arrows) expect(arrow, file).not.toMatch(/scale-x|mirror=\{false\}/);
      expect(source(file), file).not.toMatch(/scale-x-100/);
    }
  });
});

describe("creator-written text on a page", () => {
  it("runs in its own direction wherever the page prints it", () => {
    const poster = (file: string) => source(`features/directions/poster/${file}`);
    const marked = (code: string, text: string) => new RegExp(`dir="auto"[^<]*>\\s*(?:\\{/\\*[^*]*\\*/\\}\\s*)?\\{${text.replace(/[.?]/g, "\\$&")}`).test(code);
    for (const text of ["profile.displayName", "profile.tagline", "profile.bio"]) expect(marked(poster("hero.tsx"), text), text).toBe(true);
    for (const text of ["title", "block.title", "block.artist", "video.title", "item.title", "product.title", "item.name", "item.role", "block.description", "block.badge"]) {
      expect(marked(poster("cards.tsx"), text), text).toBe(true);
    }
    for (const text of ["block.title", "block.developer", "block.description"]) expect(marked(poster("apps.tsx"), text), text).toBe(true);
    expect(marked(poster("renderer.tsx"), "block.text")).toBe(true);
    expect(marked(poster("renderer.tsx"), "title")).toBe(true);
    expect(marked(poster("events.tsx"), "event.name")).toBe(true);
    expect(marked(poster("live.tsx"), "block.title")).toBe(true);
  });
});
