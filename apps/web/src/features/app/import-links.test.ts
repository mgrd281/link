import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/import-links/route";
import { safeFetch } from "@/features/ai/server/safe-fetch";

import { extractLinks, importTarget, isImportHost, pasteOnlyHost, sortImported } from "./import-links";

vi.mock("@/features/ai/server/safe-fetch", () => ({ safeFetch: vi.fn() }));

const page = new URL("https://linktr.ee/mila");

const nextData = (pageProps: unknown) =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps } })}</script></body></html>`;

describe("importTarget", () => {
  it("takes link-in-bio pages with a name, with or without https", () => {
    expect(importTarget("linktr.ee/mila")).toBeNull();
    expect(importTarget("https://www.linktr.ee/mila")).toBeNull();
    expect(pasteOnlyHost("linktr.ee/mila")).toBe("linktr.ee");
    expect(importTarget("http://beacons.ai/mila")?.href).toBe("https://beacons.ai/mila");
    expect(importTarget("mila.carrd.co")?.href).toBe("https://mila.carrd.co/");
  });

  it("refuses everything else: other sites, bare service pages, internal addresses", () => {
    expect(importTarget("https://example.com/mila")).toBeNull();
    expect(importTarget("linktr.ee")).toBeNull();
    expect(importTarget("https://linktr.ee/")).toBeNull();
    expect(importTarget("http://127.0.0.1/linktr.ee")).toBeNull();
    expect(importTarget("https://linktr.ee.evil.com/mila")).toBeNull();
    expect(importTarget("https://a.b.carrd.co/")).toBeNull();
    expect(importTarget("")).toBeNull();
  });
});

describe("extractLinks", () => {
  it("reads Linktree's page data: links, pinned and social links, without the service's own pages", () => {
    const html = nextData({
      links: [
        { title: "New single &amp; video", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", type: "CLASSIC" },
        { title: "Tour", url: "https://tickets.example.com/mila", type: "CLASSIC" },
        { title: "Another Linktree", url: "https://linktr.ee/someone-else", type: "CLASSIC" },
        { title: "Tour again", url: "https://tickets.example.com/mila/", type: "CLASSIC" },
      ],
      pinnedLinks: [],
      socialLinks: [
        { type: "INSTAGRAM", url: "https://instagram.com/mila.aurel" },
        { type: "TIKTOK", url: "https://www.tiktok.com/@milaaurel" },
      ],
      fontTags: [{ url: "https://fonts.example.com/font.css" }],
    });
    expect(extractLinks(html, page)).toEqual([
      { url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", title: "New single & video" },
      { url: "https://tickets.example.com/mila", title: "Tour" },
      { url: "https://instagram.com/mila.aurel", title: "INSTAGRAM" },
      { url: "https://www.tiktok.com/@milaaurel", title: "TIKTOK" },
    ]);
  });

  it("falls back to the page's links, skipping legal, sign-up and app store links", () => {
    const html = `
      <a href="https://youtube.com/@mila">My <b>YouTube</b></a>
      <a href='https://shop.example.com/'>Merch</a>
      <a href="/signup">Create your own</a>
      <a href="https://bio.link/privacy">Privacy</a>
      <a href="https://apps.apple.com/app/id1">App</a>
      <a href="javascript:alert(1)">x</a>
      <a href="mailto:mila@example.com">Mail</a>`;
    expect(extractLinks(html, new URL("https://bio.link/mila"))).toEqual([
      { url: "https://youtube.com/@mila", title: "My YouTube" },
      { url: "https://shop.example.com/", title: "Merch" },
      { url: "mailto:mila@example.com", title: "Mail" },
    ]);
  });
});

describe("sortImported", () => {
  const links = [
    { url: "https://instagram.com/mila.aurel", title: "" },
    { url: "https://www.tiktok.com/@milaaurel", title: "" },
    { url: "https://youtube.com/channel/UC123", title: "" },
    { url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", title: "" },
    { url: "mailto:mila@example.com", title: "" },
  ];

  it("fills the profile fields this page asks for and pastes the rest", () => {
    expect(sortImported(links, ["instagram", "tiktok", "youtube"], {})).toEqual({
      handles: { instagram: "mila.aurel", tiktok: "milaaurel" },
      links: ["https://youtube.com/channel/UC123", "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"],
    });
  });

  it("never overwrites what was typed, and keeps profiles the page doesn't ask for as links", () => {
    expect(sortImported(links, ["instagram"], { instagram: "typed" })).toEqual({
      handles: {},
      links: [
        "https://instagram.com/mila.aurel",
        "https://www.tiktok.com/@milaaurel",
        "https://youtube.com/channel/UC123",
        "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
      ],
    });
  });
});

describe("/api/import-links", () => {
  const ask = (url: string) => POST(new Request("http://localhost/api/import-links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) }));
  const fetchMock = vi.mocked(safeFetch);

  afterEach(() => {
    fetchMock.mockReset();
  });

  it("never reads Linktree: it asks for the links to be pasted", async () => {
    expect(await (await ask("https://linktr.ee/mila")).json()).toEqual({ ok: false, error: "paste" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads through the safe fetcher, only import hosts, honouring robots.txt", async () => {
    fetchMock.mockResolvedValue({ ok: false, reason: "robots" });
    expect(await (await ask("beacons.ai/mila")).json()).toEqual({ ok: false, error: "robots" });
    expect(fetchMock).toHaveBeenCalledWith("https://beacons.ai/mila", { accept: "text/html", allowHost: isImportHost, robots: true });
  });

  it("reads links against the final address after redirects", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      url: "https://bio.link/mila",
      status: 200,
      contentType: "text/html",
      body: '<a href="https://bio.link/other">Another bio.link page</a><a href="https://shop.example.com/">Shop</a>',
    });
    expect(await (await ask("beacons.ai/mila")).json()).toEqual({ ok: true, links: [{ url: "https://shop.example.com/", title: "Shop" }] });
  });

  it("answers calmly when the page is too large, missing or not a link-in-bio service", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, reason: "tooLarge", status: 200 });
    expect(await (await ask("beacons.ai/mila")).json()).toEqual({ ok: false, error: "failed" });
    fetchMock.mockResolvedValueOnce({ ok: false, reason: "notFound", status: 404 });
    expect(await (await ask("beacons.ai/mila")).json()).toEqual({ ok: false, error: "notFound" });
    expect(await (await ask("https://example.com/mila")).json()).toEqual({ ok: false, error: "unsupported" });
  });
});

// The importer reads pages of the listed services, which anyone can fill: a megabyte made of openers
// that never close took the old patterns minutes (they looked again from every opener).
describe("extractLinks on a hostile page of 1 MiB", () => {
  const MiB = 1024 * 1024;
  const fill = (piece: string, length = MiB) => piece.repeat(Math.ceil(length / piece.length)).slice(0, length);
  const timed = (html: string) => {
    const started = performance.now();
    const links = extractLinks(html, page);
    expect(performance.now() - started).toBeLessThan(200);
    return links;
  };

  it.each([
    ["anchor openers that never close", "<a "],
    ["anchors with an address and no end", '<a href="https://a.example/x">'],
    ["angle brackets", "<"],
    ["script openers", '<script id="__NEXT_DATA__" type="application/json">'],
    ["comment openers", "<!--"],
  ])("made of %s is read in well under 200 ms", (_name, piece) => {
    timed(fill(piece));
  });

  it("with one anchor text or one address as long as the page", () => {
    // Brackets that never close are text; the title is cut to its 120 characters.
    expect(timed(`<a href="https://a.example/">${fill("<")}</a>`)).toEqual([{ url: "https://a.example/", title: "<".repeat(120) }]);
    // An address of a megabyte is no link: left out, and the next one is still found.
    expect(timed(`<a href="https://a.example/${fill("/", MiB - 200)}">x</a><a href="https://b.example/">B</a>`)).toEqual([{ url: "https://b.example/", title: "B" }]);
  });

  it("does not read links inside comments or code", () => {
    const html = '<!-- <a href="https://hidden.example/">no</a> --><script>var a = \'<a href="https://code.example/">no</a>\';</script><a href="https://shown.example/">Yes</a>';
    expect(extractLinks(html, page)).toEqual([{ url: "https://shown.example/", title: "Yes" }]);
  });
});
