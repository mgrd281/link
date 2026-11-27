import type { BlockOf } from "@linkyo/blocks";
import { afterEach, describe, expect, it, vi } from "vitest";

import { appDocumentPress } from "@/features/directions/poster/laufbahn-index";
import { remind } from "@/features/directions/poster/live-time";

import { HANDLER } from "./bridge";

/**
 * The creator page's live reminder (`remind()` in features/directions/poster/live-time.ts) inside the
 * iPhone app's "View my page": the calendar file goes to the app through the bridge (a WKWebView saves
 * no blob download); in a browser it is the download it always was. The share button is checked in the
 * browser (e2e/app-mode-app.spec.ts), where it shares the page's public address.
 */

const LIVE: BlockOf<"live"> = {
  id: "live-1",
  type: "live",
  visible: true,
  highlight: false,
  platform: "twitch",
  channel: "example",
  isLive: false,
  title: "Q&A",
  url: "https://www.twitch.tv/example",
  startsAt: "2026-12-01T20:00:00.000Z",
};

/** A page with a link maker that records what it is asked to download; in the app or not. */
function page({ app }: { app: boolean }) {
  const posted: unknown[] = [];
  const clicked: { download: string; href: string }[] = [];
  const win: Record<string, unknown> = { webkit: { messageHandlers: { [HANDLER]: { postMessage: (body: unknown) => posted.push(body) } } } };
  win.self = win;
  win.top = win;
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", {
    documentElement: { dataset: app ? { app: "ios" } : {} },
    createElement: () => {
      const link = { download: "", href: "", click: () => clicked.push({ download: link.download, href: link.href }) };
      return link;
    },
  });
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:calendar", revokeObjectURL: () => undefined }));
  return { posted, clicked };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const text = (base64: string) => new TextDecoder().decode(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)));

describe("the live reminder in the app", () => {
  it("hands the calendar file to the app, its words intact, and downloads nothing", () => {
    const { posted, clicked } = page({ app: true });
    remind(LIVE, "بث مباشر: Q&A");
    expect(clicked).toEqual([]);
    expect(posted).toHaveLength(1);
    const [message] = posted as { type: string; name: string; mime: string; base64: string }[];
    expect(message).toMatchObject({ type: "download", name: "live.ics", mime: "text/calendar" });
    const calendar = text(message?.base64 ?? "");
    expect(calendar).toMatch(/^BEGIN:VCALENDAR\r\nVERSION:2.0\r\n/);
    expect(calendar).toContain("DTSTART:20261201T200000Z");
    // UTF-8, so an Arabic title arrives as written.
    expect(calendar).toContain("SUMMARY:بث مباشر: Q&A");
  });

  it("is the browser's download outside the app, and posts nothing", () => {
    const { posted, clicked } = page({ app: false });
    remind(LIVE, "Live: Q&A");
    expect(posted).toEqual([]);
    expect(clicked).toEqual([{ download: "live.ics", href: "blob:calendar" }]);
  });
});

describe("a Laufbahn page's PDF in the app", () => {
  const HREF = "https://linkyo.app/de/p/jonas-brandt/cv";
  const NAME = "Lebenslauf_Jonas_Brandt.pdf";

  /** A press on a document link (`a[data-app-download]`), in the app or not; with the app's handler and a fetch of our own PDF. */
  function press({ app, modifier = false }: { app: boolean; modifier?: boolean }) {
    const { posted } = page({ app });
    const assigned: string[] = [];
    (window as unknown as Record<string, unknown>).location = { assign: (href: string) => assigned.push(href) };
    class FakeElement {
      closest(selector: string) {
        return selector === "a[data-app-download]" ? link : null;
      }
    }
    class FakeAnchor extends FakeElement {
      href = HREF;
      download = NAME;
    }
    const link = new FakeAnchor();
    vi.stubGlobal("Element", FakeElement);
    vi.stubGlobal("HTMLAnchorElement", FakeAnchor);
    const fetched: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      fetched.push(url);
      return Promise.resolve(new Response(new Blob(["%PDF-1.7"], { type: "application/pdf" }), { status: 200 }));
    });
    let prevented = false;
    const event = { target: link, defaultPrevented: false, button: 0, metaKey: modifier, ctrlKey: false, shiftKey: false, altKey: false, preventDefault: () => (prevented = true) };
    return { taken: appDocumentPress(event as unknown as MouseEvent), prevented: () => prevented, posted, fetched, assigned };
  }

  it("hands the PDF to the app instead of a download the web view would not do", async () => {
    const result = press({ app: true });
    expect(result.taken).toBe(true);
    expect(result.prevented()).toBe(true);
    await vi.waitFor(() => expect(result.posted).toHaveLength(1));
    expect(result.fetched).toEqual([HREF]);
    expect(result.posted[0]).toMatchObject({ type: "download", name: NAME, mime: "application/pdf" });
    expect(result.assigned).toEqual([]);
  });

  it("leaves the browser's own download alone, and any press with a modifier key", () => {
    for (const result of [press({ app: false }), press({ app: true, modifier: true })]) {
      expect(result.taken).toBe(false);
      expect(result.prevented()).toBe(false);
      expect(result.posted).toEqual([]);
    }
  });
});
