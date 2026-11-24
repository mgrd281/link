"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";

/** One picture of a project page as the viewer shows it, read from its link on the page. */
export interface ViewerPicture {
  /** The largest file our own optimizer serves for it (the link's address, what opens without script). */
  href: string;
  /** The candidates of the picture on the page, so the viewer asks for the width the screen needs. */
  srcSet: string;
  /** The owner's description; empty for a decorative picture. */
  alt: string;
  /** The caption under it on the page; empty when there is none. */
  caption: string;
}

/** What the viewer needs to open: the page's pictures, the one tapped, and the link to give focus back to. */
export interface ViewerOpening {
  pictures: ViewerPicture[];
  start: number;
  opener: HTMLAnchorElement;
}

/** The viewer itself (loaded on the first tap): `./picture-viewer-dialog.tsx`. */
export type ViewerDialog = ComponentType<ViewerOpening & { onClosed: () => void }>;

/** The picture links of a project page, in page order (`data-viewer` on each, project-page.tsx). */
export function pictureLinks(root: ParentNode): HTMLAnchorElement[] {
  return [...root.querySelectorAll<HTMLAnchorElement>("a[data-viewer]")];
}

/** What the viewer shows for one picture link: the same file, description and caption as the page. */
export function readPicture(link: HTMLAnchorElement): ViewerPicture {
  const image = link.querySelector("img");
  return {
    href: link.getAttribute("href") ?? "",
    srcSet: image?.getAttribute("srcset") ?? "",
    alt: image?.getAttribute("alt") ?? "",
    caption: link.closest("figure")?.querySelector("[data-caption]")?.textContent.trim() ?? "",
  };
}

/** `index` kept inside the pictures (0 … count − 1). */
export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(index)));
}

/**
 * Which way an arrow key moves through the pictures: by what the visitor sees. The pictures run in
 * reading order, so in Arabic the next one is to the left and the left arrow goes on.
 */
export function arrowStep(key: string, rtl: boolean): -1 | 0 | 1 {
  if (key === "ArrowRight") return rtl ? -1 : 1;
  if (key === "ArrowLeft") return rtl ? 1 : -1;
  return 0;
}

/**
 * The picture a scrolled track shows. Each slide is as wide as the track; scroll offsets run negative
 * in right-to-left layouts, so the distance from the start is what counts.
 */
export function slideAt(scrollLeft: number, width: number, count: number): number {
  if (width <= 0) return 0;
  return clampIndex(Math.abs(scrollLeft) / width, count);
}

/** A plain press the viewer may take over; with a modifier the browser opens the file as it would anyway. */
export function isPlainClick(event: Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "defaultPrevented">): boolean {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** The viewer's code, fetched once: on the first press, never with the page. */
let loading: Promise<ViewerDialog> | null = null;
function loadViewer(): Promise<ViewerDialog> {
  loading ??= import("./picture-viewer-dialog").then((module) => module.PictureViewerDialog);
  // A failed load (offline) may be tried again on the next press.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/**
 * The picture viewer's island on a project page: it waits for a press on a picture link and only then
 * loads the viewer (`picture-viewer-dialog.tsx`), so a page that is only read never downloads it.
 * Without script, or if the viewer cannot load, the link opens the large file itself (our own origin,
 * shown inline). Modified clicks (a new tab) are left to the browser.
 */
export function PictureViewer() {
  const anchor = useRef<HTMLSpanElement>(null);
  const [viewer, setViewer] = useState<{ Dialog: ViewerDialog; opening: ViewerOpening; key: number } | null>(null);

  useEffect(() => {
    const mark = anchor.current;
    const root = mark?.closest<HTMLElement>("[data-project-page]");
    if (!mark || !root) return;
    const linkOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLAnchorElement>("a[data-viewer]") : null);
    // A finger on a picture starts the download; the press that follows opens it.
    const warm = (event: PointerEvent) => {
      if (linkOf(event.target)) void loadViewer().catch(() => undefined);
    };
    const open = (event: MouseEvent) => {
      const link = linkOf(event.target);
      if (!link || !root.contains(link) || !isPlainClick(event)) return;
      const links = pictureLinks(root);
      const start = links.indexOf(link);
      if (start < 0) return;
      event.preventDefault();
      const opening: ViewerOpening = { pictures: links.map(readPicture), start, opener: link };
      loadViewer().then(
        (Dialog) => setViewer({ Dialog, opening, key: Date.now() }),
        () => window.location.assign(link.href),
      );
    };
    root.addEventListener("pointerdown", warm, { passive: true });
    root.addEventListener("click", open);
    // From here a press opens the viewer (tests and tools can wait for it).
    mark.dataset.viewerReady = "";
    return () => {
      delete mark.dataset.viewerReady;
      root.removeEventListener("pointerdown", warm);
      root.removeEventListener("click", open);
    };
  }, []);

  return (
    <>
      <span ref={anchor} hidden />
      {viewer ? <viewer.Dialog key={viewer.key} {...viewer.opening} onClosed={() => setViewer(null)} /> : null}
    </>
  );
}
