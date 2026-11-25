import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Picture } from "./picture";
import { source, trimSrcSet } from "./picture-source";

const url = (width: number) => `/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fshot.jpg&w=${String(width)}&q=75`;
const list = (widths: number[]) => widths.map((width) => `${url(width)} ${String(width)}w`).join(", ");
/** The widths a `srcset` attribute names, in order. */
const widthsOf = (markup: string) => Array.from(/srcSet="([^"]*)"/i.exec(markup)?.[1]?.split(", ") ?? [], (entry) => Number(/ (\d+)w$/.exec(entry)?.[1]));

describe("the home page's pictures (E-03, ADR 0008)", () => {
  it("lists only widths that can differ: every width below the picture's own and the first at or above it", () => {
    // A 640 px picture: 750 … 3840 return the very same 640 px picture (the optimizer never enlarges).
    expect(trimSrcSet(list([384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840]), 640)).toEqual({ srcSet: list([384, 640]), src: url(640) });
    // A 192 px face: 256 is the first width at or above it.
    expect(trimSrcSet(list([32, 48, 64, 96, 128, 256, 384, 640, 750]), 192)).toEqual({ srcSet: list([32, 48, 64, 96, 128, 256]), src: url(256) });
    // A list in density form, or a picture of unknown width, stays as it is.
    expect(trimSrcSet(`${url(48)} 1x, ${url(96)} 2x`, 48)).toBeNull();
    expect(trimSrcSet(list([384, 640, 750]), undefined)).toBeNull();
  });

  it("passes a bundled picture on without its blurred preview", () => {
    const shot = { src: "/_next/static/media/shot.jpg", width: 640, height: 2650, blurDataURL: "data:image/jpeg;base64,AAAA", blurWidth: 2, blurHeight: 8 };
    expect(source(shot)).toEqual({ src: "/_next/static/media/shot.jpg", width: 640, height: 2650 });
  });

  it("draws next/image's attributes without a blurred preview, with the short list", () => {
    const shot = { src: "/_next/static/media/shot.jpg", width: 640, height: 2650 };
    const markup = renderToStaticMarkup(createElement(Picture, { src: shot, alt: "", sizes: "(max-width: 1024px) 45vw, 280px", className: "h-auto w-full" }));
    expect(markup).toMatch(/^<img /);
    expect(markup).toContain('data-nimg="1"');
    expect(markup).toContain('width="640"');
    expect(markup).toContain('height="2650"');
    expect(markup).toContain('decoding="async"');
    expect(markup).not.toContain("background-image");
    expect(markup).not.toContain("data:image");
    const widths = widthsOf(markup);
    expect(widths.length).toBeGreaterThan(0);
    // Only the last width reaches the picture's own; `src` is that entry.
    expect(widths.filter((width) => width >= 640)).toHaveLength(1);
    expect(widths.at(-1)).toBeGreaterThanOrEqual(640);
    expect(markup).toContain(`src="/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fshot.jpg&amp;w=${String(widths.at(-1))}&amp;q=75"`);
  });

  it("fills its box as next/image does, and keeps a picture of unknown width whole", () => {
    const fill = renderToStaticMarkup(createElement(Picture, { src: { src: "/_next/static/media/card.jpg", width: 640, height: 1385 }, alt: "", fill: true, sizes: "224px" }));
    expect(fill).toContain('data-nimg="fill"');
    expect(fill).toContain("position:absolute");
    expect(widthsOf(fill).filter((width) => width >= 640)).toHaveLength(1);
    // A card made on the server (an address, its size given): trimmed at its given width.
    const card = renderToStaticMarkup(createElement(Picture, { src: "/de/p/journalist/opengraph-image", width: 1200, height: 630, alt: "", sizes: "280px" }));
    expect(widthsOf(card).filter((width) => width >= 1200)).toHaveLength(1);
  });
});
