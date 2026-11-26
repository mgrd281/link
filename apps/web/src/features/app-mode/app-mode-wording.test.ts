/**
 * App mode (ADR 0087): no "Pro" wording inside the iPhone app (App Store 3.1.3(f): no call
 * to action for a purchase). Where the dashboard tells a Free account about a paid plan, the app says
 * the fact in words of its own (`appMode.*`): without "Pro", without a price, without a hint to buy.
 */
import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { useErrorText } from "../ai/build-screen";
import type { AiQuota } from "../ai/quota";
import { ProSheet } from "../ai/pro-sheet";

const mode = vi.hoisted(() => ({ app: false }));

vi.mock("@/features/app-mode/use-app-mode", () => ({ useAppMode: () => mode.app }));
// Node has no router and no portal target: links render plain, the sheet renders in place.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children?: ReactNode }) => createElement("a", { href }, children),
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  usePathname: () => "/app/build",
}));
vi.mock("@/features/app/sheet", () => ({
  Sheet: ({ open, title, closeLabel, children, footer }: { open: boolean; title: string; closeLabel: string; children?: ReactNode; footer?: ReactNode }) =>
    open ? createElement("section", { "aria-label": closeLabel }, createElement("h2", null, title), children, footer) : null,
}));

const CATALOGUES = { de, en, ar } as const;
type Locale = keyof typeof CATALOGUES;
const LOCALES = Object.keys(CATALOGUES) as Locale[];

/** Every string under a node, by its dotted key. */
function strings(node: unknown, prefix: string): [string, string][] {
  if (typeof node === "string") return [[prefix, node]];
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, value]) => strings(value, `${prefix}.${key}`));
}

const ENTITIES: Record<string, string> = { "&#x27;": "'", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&amp;": "&" };
const decode = (html: string) => html.replace(/&#x27;|&quot;|&lt;|&gt;|&amp;/g, (entity) => ENTITIES[entity] ?? entity);

/** The visible text of rendered markup (tags dropped, `aria-label`s kept: a screen reader says them). */
const textOf = (markup: string) => decode(`${markup.replace(/<[^>]+>/g, " ")} ${[...markup.matchAll(/aria-label="([^"]*)"/g)].map(([, label]) => label).join(" ")}`);

function render(locale: Locale, app: boolean, element: ReactNode): string {
  mode.app = app;
  return textOf(renderToStaticMarkup(createElement(NextIntlClientProvider, { locale, messages: CATALOGUES[locale], timeZone: "Europe/Berlin", children: element })));
}

/** A Free account whose one free draft is used. */
const USED: AiQuota = { plan: "free", allowance: 1, used: 1, left: 0, period: "life", resetsAt: null };

function QuotaError() {
  return createElement("p", null, useErrorText()("quota", USED));
}

describe("app mode: the app's own words name no plan to buy", () => {
  it("appMode.* says no 'Pro', no price and no currency, in every language", () => {
    for (const locale of LOCALES) {
      const found = strings(CATALOGUES[locale].appMode, "appMode");
      // The AI sheet's title and close, the quota, the invite terms and Home's invite line.
      expect(found.length, locale).toBeGreaterThanOrEqual(5);
      for (const [key, text] of found) {
        expect(text, `${locale} ${key}`).not.toMatch(/\bPro\b/);
        expect(text, `${locale} ${key}`).not.toMatch(/€|\$|£|EUR\b|\d+[.,]\d{2}/);
      }
    }
  });

  it("the AI's words say plainly that drafts are not available for this account: no hint at an unlock, plan, price or upgrade", () => {
    // "nicht freigeschaltet" / "aren't enabled" read as something that could be switched on (a call to
    // action in disguise, 3.1.3(f)); the app states the fact.
    const UNLOCK = /freigeschaltet|freischalt|aktivier|enabled|unlock|activat|upgrade|\bplan\b|مفعّل|مفعل|تفعيل|ترقية|خطة/i;
    const AVAILABLE: Record<Locale, RegExp> = { de: /nicht verfügbar|gibt es .* nicht/, en: /aren't available/, ar: /غير متاحة|لا تتوفر/ };
    for (const locale of LOCALES) {
      const { title, quotaFree } = CATALOGUES[locale].appMode.ai;
      for (const [key, text] of [
        ["title", title],
        ["quotaFree", quotaFree],
      ] as const) {
        expect(text, `${locale} appMode.ai.${key}`).not.toMatch(UNLOCK);
        expect(text, `${locale} appMode.ai.${key}`).toMatch(AVAILABLE[locale]);
      }
    }
  });

  it("the AI sheet for a Free account states the fact in the app, and still offers Pro in a browser", () => {
    for (const locale of LOCALES) {
      const sheet = createElement(ProSheet, { open: true, onOpenChange: () => undefined });
      const inApp = render(locale, true, sheet);
      expect(inApp, locale).toContain(CATALOGUES[locale].appMode.ai.title);
      expect(inApp, locale).toContain(CATALOGUES[locale].appMode.ai.close);
      expect(inApp, locale).not.toMatch(/\bPro\b/);
      expect(inApp, locale).not.toContain(CATALOGUES[locale].app.ai.pro.later);
      // The way to the plan stays, so the sheet still leads somewhere.
      expect(inApp, locale).toContain(CATALOGUES[locale].app.settings.plan.open);

      const inBrowser = render(locale, false, sheet);
      expect(inBrowser, locale).toContain(CATALOGUES[locale].app.ai.pro.title);
    }
  });

  it("the used-up free draft says so in the app without 'Pro'; a browser keeps its words", () => {
    for (const locale of LOCALES) {
      const inApp = render(locale, true, createElement(QuotaError));
      expect(inApp, locale).toContain(CATALOGUES[locale].appMode.ai.quotaFree);
      expect(inApp, locale).not.toMatch(/\bPro\b/);
      expect(render(locale, false, createElement(QuotaError)), locale).toContain(CATALOGUES[locale].app.ai.errors.quotaFree);
    }
  });
});
