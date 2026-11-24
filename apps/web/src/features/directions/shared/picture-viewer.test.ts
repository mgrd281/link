import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";

import { arrowStep, clampIndex, isPlainClick, PictureViewer, readPicture, slideAt, type ViewerPicture } from "./picture-viewer";
import { PictureViewerDialog } from "./picture-viewer-dialog";
import { cardStep, railEdges } from "./rail-buttons";

/** A picture link as project-page.tsx renders it, reduced to what the viewer reads. */
function link({ href, srcset, alt, caption }: { href: string; srcset?: string; alt?: string; caption?: string }): HTMLAnchorElement {
  const image = { getAttribute: (name: string) => (name === "srcset" ? (srcset ?? null) : name === "alt" ? (alt ?? null) : null) };
  const figure = { querySelector: (selector: string) => (selector === "[data-caption]" && caption !== undefined ? { textContent: caption } : null) };
  return {
    getAttribute: (name: string) => (name === "href" ? href : null),
    querySelector: (selector: string) => (selector === "img" ? image : null),
    closest: (selector: string) => (selector === "figure" ? figure : null),
  } as unknown as HTMLAnchorElement;
}

const pictures: ViewerPicture[] = Array.from({ length: 11 }, (_, index) => ({
  href: `/_next/image?url=%2Fp${String(index + 1)}.jpg&w=3840&q=75`,
  srcSet: "",
  alt: index === 4 ? "" : `Bild ${String(index + 1)}`,
  caption: index === 2 ? "Hafen bei Nacht" : "",
}));

function renderDialog(locale: "de" | "ar", start: number): string {
  const opener = {} as HTMLAnchorElement;
  const tree = createElement(PictureViewerDialog, { pictures, start, opener, onClosed: () => undefined });
  return renderToStaticMarkup(createElement(NextIntlClientProvider, { locale, messages: locale === "ar" ? ar : de, timeZone: "Europe/Berlin", children: tree as ReactNode }));
}

describe("the picture viewer's keys follow what the visitor sees", () => {
  it("the right arrow goes on from left to right, back from right to left", () => {
    expect(arrowStep("ArrowRight", false)).toBe(1);
    expect(arrowStep("ArrowLeft", false)).toBe(-1);
    // In Arabic the pictures run from right to left: the left arrow goes on.
    expect(arrowStep("ArrowLeft", true)).toBe(1);
    expect(arrowStep("ArrowRight", true)).toBe(-1);
  });

  it("other keys do not move the pictures", () => {
    for (const key of ["ArrowUp", "ArrowDown", "Enter", " ", "Tab", "a"]) expect(arrowStep(key, false)).toBe(0);
  });
});

describe("the picture a track shows", () => {
  it("counts whole slides from the start, in both directions", () => {
    expect(slideAt(0, 390, 11)).toBe(0);
    expect(slideAt(780, 390, 11)).toBe(2);
    // Right to left: the offset runs negative.
    expect(slideAt(-780, 390, 11)).toBe(2);
    // Half way through a swipe it is the nearer one.
    expect(slideAt(390 * 2.4, 390, 11)).toBe(2);
    expect(slideAt(390 * 2.6, 390, 11)).toBe(3);
  });

  it("stays inside the pictures", () => {
    expect(slideAt(99_999, 390, 11)).toBe(10);
    expect(slideAt(100, 0, 11)).toBe(0);
    expect(clampIndex(-3, 11)).toBe(0);
    expect(clampIndex(12, 11)).toBe(10);
    expect(clampIndex(4, 0)).toBe(0);
  });
});

describe("which presses the viewer takes over", () => {
  const press = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
  it("a plain press opens the viewer", () => {
    expect(isPlainClick(press)).toBe(true);
  });

  it("a new tab, a download, a middle click or a handled press are the browser's", () => {
    expect(isPlainClick({ ...press, metaKey: true })).toBe(false);
    expect(isPlainClick({ ...press, ctrlKey: true })).toBe(false);
    expect(isPlainClick({ ...press, shiftKey: true })).toBe(false);
    expect(isPlainClick({ ...press, altKey: true })).toBe(false);
    expect(isPlainClick({ ...press, button: 1 })).toBe(false);
    expect(isPlainClick({ ...press, defaultPrevented: true })).toBe(false);
  });
});

describe("what the viewer reads from a picture link", () => {
  it("the same file, candidates, description and caption as the page", () => {
    expect(readPicture(link({ href: "/_next/image?url=a&w=3840&q=75", srcset: "/a 640w, /b 1080w", alt: "Ein Kran im Nebel", caption: " Hafen, 2024 " }))).toEqual({
      href: "/_next/image?url=a&w=3840&q=75",
      srcSet: "/a 640w, /b 1080w",
      alt: "Ein Kran im Nebel",
      caption: "Hafen, 2024",
    });
  });

  it("a decorative picture without a caption stays silent", () => {
    expect(readPicture(link({ href: "/x", alt: "" }))).toEqual({ href: "/x", srcSet: "", alt: "", caption: "" });
  });
});

describe("the viewer as it opens", () => {
  it("is a labelled dialog on the tapped picture, with a counter and a polite live region", () => {
    const html = renderDialog("de", 2);
    expect(html).toContain("<dialog");
    expect(html).toContain('aria-label="Bildansicht"');
    expect(html).toMatch(/data-viewer-counter[^>]*><bdi dir="ltr">3 \/ 11<\/bdi>/);
    expect(html).toContain('aria-live="polite" class="sr-only">Bild 3 von 11</p>');
    expect(html).toContain("Hafen bei Nacht");
    // One slide per picture, every one whole (object-contain), the decorative one without words.
    expect(html.match(/<img /g)).toHaveLength(11);
    expect(html.match(/object-contain/g)).toHaveLength(11);
    expect(html).toContain('alt=""');
  });

  it("names its buttons and disables only the way that has no picture", () => {
    const first = renderDialog("de", 0);
    expect(first).toContain('aria-label="Schließen"');
    expect(first).toMatch(/aria-label="Vorheriges Bild" aria-disabled="true"/);
    expect(first).not.toMatch(/aria-label="Nächstes Bild" aria-disabled="true"/);
    const last = renderDialog("de", 10);
    expect(last).toMatch(/aria-label="Nächstes Bild" aria-disabled="true"/);
    expect(last).not.toMatch(/aria-label="Vorheriges Bild" aria-disabled="true"/);
  });

  it("speaks Arabic, with Latin digits and chevrons that mirror", () => {
    const html = renderDialog("ar", 2);
    expect(html).toContain('aria-label="عارض الصور"');
    expect(html).toContain("الصورة 3 من 11");
    expect(html).toContain('<bdi dir="ltr">3 / 11</bdi>');
    expect(html.match(/rtl:-scale-x-100/g)).toHaveLength(2);
  });

  it("fades in with the motion token, and not at all with reduced motion", () => {
    const html = renderDialog("de", 0);
    expect(html).toContain("duration-standard");
    expect(html).toContain("starting:open:opacity-0");
    expect(html).toContain("motion-reduce:transition-none");
  });

  it("is not on the page until a picture is pressed", () => {
    const html = renderToStaticMarkup(createElement(NextIntlClientProvider, { locale: "de", messages: de, timeZone: "Europe/Berlin", children: createElement(PictureViewer) as ReactNode }));
    expect(html).toBe('<span hidden=""></span>');
  });
});

describe("the rail buttons", () => {
  it("move by one card: its width and the gap, in either direction", () => {
    expect(cardStep({ left: 160, width: 322 }, { left: 506 })).toBe(346);
    // Right to left the next card sits further left.
    expect(cardStep({ left: 958, width: 322 }, { left: 612 })).toBe(346);
    expect(cardStep({ left: 0, width: 300 }, undefined)).toBe(300);
    expect(cardStep(undefined, undefined)).toBe(0);
  });

  it("know the ends of the row, also from right to left", () => {
    expect(railEdges(0, 1120, 1900)).toEqual({ start: true, end: false, scrolls: true });
    expect(railEdges(780, 1120, 1900)).toEqual({ start: false, end: true, scrolls: true });
    expect(railEdges(-780, 1120, 1900)).toEqual({ start: false, end: true, scrolls: true });
    expect(railEdges(-300, 1120, 1900)).toEqual({ start: false, end: false, scrolls: true });
    // A row that fits does not scroll at all.
    expect(railEdges(0, 1120, 1120)).toEqual({ start: true, end: true, scrolls: false });
  });
});
