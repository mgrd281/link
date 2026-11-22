import type { Block, Page } from "@linkyo/blocks";
import { NextIntlClientProvider } from "next-intl";
import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";

import { DraftPhone } from "./draft-phone";
import type { AiRunEvent } from "./events";
import { DraftReview } from "./review";
import { runFromEvents, type RunState } from "./run-reducer";
import { AiRunView, draftPage } from "./run-view";

// The exported contract the homepage replay (WP5) and the team console (WP7) build on, rendered to
// HTML in Node (no browser, no testing library): what each prop promises is in the markup.

// The app's localized navigation needs Next's router, which Node alone does not have; links render plain.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: unknown }) => createElement("a", { href, ...rest }, children as never),
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  usePathname: () => "/app/build",
}));

const block = (id: string, title: string): Block => ({ id, type: "link", title, url: `https://example.com/${id}`, visible: true, highlight: false, origin: "ai" });

const EVENTS: AiRunEvent[] = [
  { type: "run", id: "run-1", plan: "free", left: 0 },
  { type: "step", key: "read", state: "start" },
  { type: "source", id: "S1", kind: "website", label: "lio-vance.de", status: "read" },
  { type: "step", key: "read", state: "done", counts: { links: 5, profiles: 1 } },
  { type: "step", key: "details", state: "skip" },
  { type: "step", key: "colors", state: "skip" },
  { type: "step", key: "plan", state: "start" },
  { type: "step", key: "plan", state: "done", ms: 4000 },
  { type: "look", kind: "music", theme: { template: "nocturne" } },
  { type: "profile", profile: { displayName: "Lio Vance", tagline: "DJ · Producer", bio: "Berlin." } },
  { type: "step", key: "write", state: "start" },
  { type: "block", index: 0, block: block("b1", "Booking") },
  { type: "block", index: 1, block: block("b2", "Tickets") },
  { type: "notes", notes: [{ topic: "look", text: "Dunkel wie ein Club." }] },
];

const running = (): RunState => runFromEvents(EVENTS, (index) => index * 1000);

const page = (state: RunState): Page => ({
  profile: { username: "lio-vance", displayName: "Lio Vance", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" },
  blocks: state.blocks,
});

const done = (): RunState =>
  runFromEvents([
    ...EVENTS,
    { type: "step", key: "write", state: "done", counts: { blocks: 2 } },
    { type: "step", key: "check", state: "start" },
    { type: "step", key: "check", state: "done", counts: { fixed: 0, dropped: 0 } },
    { type: "done", runId: "run-1", page: page(running()), theme: { template: "nocturne" }, kind: "music", fixed: 0, dropped: 0, fallback: false, counted: true, expiresAt: "2026-11-29T12:00:00.000Z", ms: 9000 },
  ]);

/** Renders an element with the app's messages, as the layout's provider does. */
const html = (element: ReactNode, locale: "de" | "ar" = "de"): string =>
  renderToStaticMarkup(createElement(NextIntlClientProvider, { locale, messages: locale === "de" ? de : ar, timeZone: "Europe/Berlin", children: element }));

function render(props: Partial<ComponentProps<typeof AiRunView>> = {}, locale: "de" | "ar" = "de"): string {
  return html(createElement(AiRunView, { state: running(), source: "live", tone: "console", announce: true, ...props }), locale);
}

const LIVE_REGIONS = /role="(?:log|status|alert)"|aria-live=/g;
const liveRegions = (markup: string) => markup.match(LIVE_REGIONS)?.length ?? 0;

/** The creator's page alone, as the phone shows it (inert and hidden: none of it reaches a screen reader). */
function phoneOnly(state: RunState): string {
  const { page: draft, theme } = draftPage(state, { username: "draft" }, "de");
  return html(createElement(DraftPhone, { page: draft, theme, label: "phone", busy: false }));
}

describe("AiRunView", () => {
  it("labels a recording and test data, and never a live run", () => {
    expect(render({ source: "recording", recordedAt: "2026-11-20T10:00:00.000Z" })).toContain("Aufzeichnung · echter KI-Lauf mit einer erfundenen Beispielperson, 20. November 2026");
    expect(render({ source: "fixture" })).toContain(de.ai.run.fixtureChip);
    const live = render({ source: "live" });
    expect(live).not.toContain("data-run-source");
    expect(live).not.toContain(de.ai.run.fixtureChip);
    expect(render({ source: "fixture", shortenedMs: 41_000 })).toContain("Wartezeit gekürzt (echt: 41 s)");
  });

  it("with announce: false, nothing in it is a live region (no log, status, alert or aria-live)", () => {
    for (const state of [running(), done()]) {
      // The creator's page in the phone is inert and aria-hidden (its own share button's status
      // never reaches a screen reader); the view around it has none at all.
      const phone = phoneOnly(state);
      expect(phone).toMatch(/<div inert="" aria-hidden="true"/);
      expect(liveRegions(render({ announce: false, source: "fixture", state }))).toBe(liveRegions(phone));
    }
    // With announce, the log is there (and the run's end is said once, as a status).
    const spoken = render({ announce: true });
    expect(spoken).toContain('role="log"');
    expect(spoken).toContain('aria-live="polite"');
    expect(spoken).toContain('role="status"');
    expect(render({ announce: true, state: done() })).toContain("Entwurf fertig: 2 Blöcke, Look Nocturne.");
  });

  it("has a Stop button only with onStop", () => {
    expect(render({})).not.toContain(`>${de.ai.run.stop}<`);
    expect(render({ onStop: () => undefined })).toContain(`>${de.ai.run.stop}<`);
    expect(render({ onStop: () => undefined })).toContain(de.ai.run.stopCounts);
  });

  it("tone brand renders no data-console; console marks its subtree", () => {
    expect(render({ tone: "brand" })).not.toContain("data-console");
    expect(render({ tone: "console" })).toContain('data-console="local"');
  });

  it("shows the run as it is: the step it is on, the sources it read, the progress and the draft chip", () => {
    const markup = render({});
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuemax="7"');
    expect(markup).toContain('aria-valuenow="5"');
    expect(markup).toContain("Schritt 6 von 7");
    // Phones (the first render): the sheet peeks at two rows, with tabs for what was read and why.
    expect(markup).toContain(`>${de.ai.run.sheet.read}<`);
    expect(markup).toContain(`>${de.ai.run.sheet.why}<`);
    expect(markup).toContain(`>${de.ai.run.sheet.all}<`);
    expect(markup).toContain(de.ai.run.draftChip);
    expect(markup).toContain('aria-busy="true"');
    // The draft is a picture: inert, hidden from screen readers.
    expect(markup).toMatch(/<div inert="" aria-hidden="true"/);
  });

  it("shows the review in place of the run once the draft is ready", () => {
    const markup = render({ state: done(), review: createElement("p", null, "REVIEW") });
    expect(markup).toContain("REVIEW");
    expect(markup).not.toContain('role="progressbar"');
  });

  it("speaks Arabic in Arabic, with addresses left to right", () => {
    const markup = render({}, "ar");
    expect(markup).toContain(ar.ai.run.draftChip);
    expect(markup).toContain("الخطوة 6 من 7");
    expect(markup).toContain('dir="ltr"');
  });
});

describe("DraftReview", () => {
  it("lists every block with a checkbox (the words for the phone), the notes, other looks and the actions", () => {
    const state = done();
    const markup = html(
      createElement(DraftReview, {
        kind: "ai",
        draft: { page: page(state), theme: { template: "nocturne" }, kind: "music" },
        before: null,
        notes: state.notes,
        sources: state.sources,
        chip: createElement("p", null, "CHIP"),
        actions: createElement("button", { type: "button" }, "APPLY"),
      }),
    );
    expect(markup).toContain(de.app.ai.review.title);
    expect(markup.match(/type="checkbox"/g)).toHaveLength(2);
    expect(markup).toContain('aria-label="Booking behalten"');
    expect(markup).toContain("Dunkel wie ein Club.");
    expect(markup).toContain(de.app.ai.review.looks);
    // The AI's look and three others, as radios.
    expect(markup.match(/type="radio"/g)).toHaveLength(4);
    expect(markup).toContain("APPLY");
    expect(markup).toContain("CHIP");
    expect(markup).not.toContain(de.app.ai.review.compare);
  });
});
