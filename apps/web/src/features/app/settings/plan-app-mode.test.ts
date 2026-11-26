/**
 * The plan pane inside Linkyo's iPhone app (ADR 0087, the lead's decision on the plan pane): the plan's
 * name and its state only. The account's own plan, bought elsewhere, may be named ("Linkyo Pro", App
 * Store 3.1.3(b)); where it comes from (a price, Stripe, the invite reward), the feature list, a
 * past-due badge or note (a payment nudge) and every payment row are not shown. The AI drafts left stay:
 * they name no plan, price or upgrade. A browser keeps the whole pane.
 */
import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AiQuotaView } from "@/features/ai/quota";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { FREE_PLAN, PlanGroups, type PlanView } from "./plan-screen";

const mode = vi.hoisted(() => ({ app: false }));

vi.mock("@/features/app-mode/use-app-mode", () => ({ useAppMode: () => mode.app }));
// Node has no router: links render plain.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children?: ReactNode }) => createElement("a", { href }, children),
}));

const CATALOGUES = { de, en, ar } as const;
type Locale = keyof typeof CATALOGUES;
const LOCALES = Object.keys(CATALOGUES) as Locale[];

const LATER = "2099-01-01T00:00:00Z";
const PRO = { ...FREE_PLAN, plan: "pro" } as const;
/** The accounts the pane can meet, as `planFrom` reads them. */
const VIEWS = {
  free: FREE_PLAN,
  reward: { ...PRO, source: "reward" },
  team: { ...PRO, source: "team", endsAt: LATER },
  trial: { ...PRO, source: "team", trial: true, endsAt: LATER },
  stripe: { ...PRO, source: "stripe", renewsAt: LATER, customer: true, invoices: [{ id: "in_1", at: "2026-11-01T09:00:00Z", amount_cents: 800, status: "paid" }] },
  ending: { ...PRO, source: "stripe", endsAt: LATER, customer: true },
  pastDue: { ...PRO, source: "stripe", pastDue: true, renewsAt: LATER, customer: true },
} satisfies Record<string, PlanView>;

const QUOTA: AiQuotaView = {
  status: "ready",
  enabled: true,
  off: null,
  quota: { plan: "pro", allowance: 5, used: 2, left: 3, period: "month", resetsAt: "2026-12-01T00:00:00+01:00" },
  refresh: () => Promise.resolve(),
};

const ENTITIES: Record<string, string> = { "&#x27;": "'", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&amp;": "&" };
/**
 * The visible text of rendered markup (tags dropped, `aria-label`s kept). `separator` goes where a tag
 * was: "" reads a sentence with a Latin name in `<bdi>` as one; "\n" keeps the words of two elements
 * apart, so a "Pro" never hides against the next element's word.
 */
function textOf(markup: string, separator: string): string {
  const text = markup.replace(/<[^>]+>/g, separator).replace(/&#x27;|&quot;|&lt;|&gt;|&amp;/g, (entity) => ENTITIES[entity] ?? entity);
  const labels = [...markup.matchAll(/aria-label="([^"]*)"/g)].map(([, label]) => label);
  return [text, ...labels].join("\n");
}

function markup(locale: Locale, app: boolean, view: PlanView): string {
  mode.app = app;
  const pane = createElement(PlanGroups, { view, quota: QUOTA });
  return renderToStaticMarkup(createElement(NextIntlClientProvider, { locale, messages: CATALOGUES[locale], timeZone: "Europe/Berlin", children: pane }));
}
/** The pane's text, each element's words on a line of their own. */
const words = (locale: Locale, app: boolean, view: PlanView) => textOf(markup(locale, app, view), "\n");
/** The pane's text with sentences whole. */
const render = (locale: Locale, app: boolean, view: PlanView) => textOf(markup(locale, app, view), "");

/** A message as it reads on screen: ICU tags (`<bdi>`) and arguments dropped. */
const plain = (message: string) => message.replace(/<\/?bdi>/g, "").replace(/\{[^}]*\}/g, "");

describe("the plan pane in the iPhone app", () => {
  for (const locale of LOCALES) {
    const m = CATALOGUES[locale].app.settings.plan;

    it(`${locale}: only the plan's name may say "Pro"; no price, no payment, no Stripe, no source and no feature list`, () => {
      for (const [name, view] of Object.entries(VIEWS) as [string, PlanView][]) {
        const text = render(locale, true, view);
        const lines = words(locale, true, view);
        expect(text, `${name}: the plan's name`).toContain(plain(m.name[view.plan]));
        expect(lines.replaceAll("Linkyo Pro", ""), `${name}: "Pro"`).not.toMatch(/\bPro\b/);
        expect(lines, `${name}: a price`).not.toMatch(/€|\d+[.,]\d{2}/);
        expect(lines, `${name}: Stripe`).not.toContain("Stripe");
        expect(lines, `${name}: payment`).not.toMatch(/Zahlung|[Pp]ayment|الدفع/);
        for (const source of Object.values(m.source)) expect(text, `${name}: the source line`).not.toContain(plain(source).trim());
        expect(text, `${name}: the feature list`).not.toContain(m.groups.includes);
        expect(text, `${name}: the past-due note`).not.toContain(plain(m.pastDue).slice(0, 20));
        // The AI drafts left stay.
        expect(text, `${name}: the AI drafts`).toContain(m.groups.ai);
      }
    });

    it(`${locale}: the states that ask for nothing stay; a past-due account shows no badge rather than a false "active"`, () => {
      expect(render(locale, true, VIEWS.reward)).toContain(m.status.reserved);
      expect(render(locale, true, VIEWS.stripe)).toContain(m.status.active);
      expect(render(locale, true, VIEWS.team)).toContain(m.status.active);
      expect(render(locale, true, VIEWS.ending)).toContain(m.status.ending);
      const pastDue = render(locale, true, VIEWS.pastDue);
      for (const badge of Object.values(m.status)) expect(pastDue, badge).not.toContain(badge);
    });

    it(`${locale}: a browser keeps the source, the feature list and the past-due badge and note`, () => {
      const reward = render(locale, false, VIEWS.reward);
      expect(reward).toContain(plain(m.source.reward).trim());
      expect(reward).toContain(m.groups.includes);
      const pastDue = render(locale, false, VIEWS.pastDue);
      expect(pastDue).toContain(m.status.pastDue);
      expect(pastDue).toContain(plain(m.pastDue).slice(0, 20));
    });
  }
});
