import { describe, expect, it } from "vitest";

import { extractLinks } from "@/features/app/import-links";

import { decodeText, pageLinks, readPage } from "./html";
import { attributes, closingTag, eachTag, scanPage, stripCode, stripTags, TAGS_MAX } from "./html-scan";

const base = new URL("https://lio-vance.de/");

describe("readPage", () => {
  it("reads title, description, the JSON-LD person, rel=me and links to other sites", () => {
    const html = `<!doctype html><html><head>
      <title>Lio Vance &ndash; DJ &amp; Producer</title>
      <meta name="description" content="Elektronische Musik aus Berlin.">
      <meta property="og:description" content="OG text">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Site"},{"@type":["Person"],"name":"Lio Vance","description":"DJ und Producer.","sameAs":["https://instagram.com/lio.vance","http://insecure.example.com/x"]}]}</script>
      <link rel="me" href="https://mastodon.social/@lio">
      <script>document.write('<a href="https://evil.example/">x</a>')</script>
      <style>a::after{content:"<a href='https://style.example/'>"}</style>
      </head><body>
      <a href="/about">About</a>
      <a href="https://soundcloud.com/lio-vance" rel="noopener me">My <b>SoundCloud</b></a>
      <a href="mailto:booking@lio-vance.de">Booking</a>
      <a href="javascript:alert(1)">x</a>
      <a href="http://plain.example.com/">Plain</a>
      <!-- <a href="https://comment.example/">hidden</a> -->
      </body></html>`;
    const page = readPage(html, base);
    expect(page.title).toBe("Lio Vance – DJ & Producer");
    expect(page.description).toBe("Elektronische Musik aus Berlin.");
    expect(page.name).toBe("Lio Vance");
    expect(page.bio).toBe("DJ und Producer.");
    expect(page.sameAs).toEqual(["https://instagram.com/lio.vance"]);
    expect(page.relMe).toEqual(["https://mastodon.social/@lio", "https://soundcloud.com/lio-vance"]);
    expect(page.links).toEqual([
      { url: "https://soundcloud.com/lio-vance", title: "My SoundCloud" },
      { url: "mailto:booking@lio-vance.de", title: "Booking" },
    ]);
  });

  it("falls back to Open Graph and caps long texts", () => {
    const page = readPage(`<meta property="og:title" content="${"T".repeat(200)}"><meta property="og:description" content="${"D".repeat(400)}">`, base);
    expect(page.title).toHaveLength(120);
    expect(page.description).toHaveLength(300);
  });

  it("survives broken JSON-LD", () => {
    expect(readPage('<script type="application/ld+json">{oops</script>', base)).toMatchObject({ sameAs: [], name: undefined });
  });

  it("decodes entities and strips tags", () => {
    expect(decodeText("a&nbsp;<i>b</i> &#x2764; &#65; &unknown;")).toBe("a b ❤ A &unknown;");
  });
});

describe("html-scan", () => {
  it("reads attributes in every spelling, the first of a repeated name", () => {
    expect({ ...attributes(`<a  HREF="https://a.example/x?y=1&amp;z=2" rel='me nofollow' data-x=1 hidden title = "a > b" href="second">`) }).toEqual({
      href: "https://a.example/x?y=1&amp;z=2",
      rel: "me nofollow",
      "data-x": "1",
      hidden: "",
      title: "a > b",
    });
    expect({ ...attributes('<meta name=description content="x"/>') }).toEqual({ name: "description", content: "x" });
    expect({ ...attributes('<a href="unclosed>') }).toEqual({ href: "unclosed>" });
    expect({ ...attributes("<a = == href=x>") }).toEqual({ href: "x" });
    expect(attributes('<a __proto__="x" constructor="y">').href).toBeUndefined();
  });

  it("walks the named tags and comments left to right, and stops at what never ends", () => {
    const html = '<p>x</p><!-- c --><A href="1">one</a><abbr>no</abbr><a\nhref="2">two</A><a href="3"';
    const seen: string[] = [];
    const stopped = eachTag(html, ["a"], (tag) => {
      seen.push(`${tag.name}:${html.slice(tag.start, tag.end)}`);
      return undefined;
    });
    expect(seen).toEqual(["!--:<!-- c -->", 'a:<A href="1">', 'a:<a\nhref="2">']);
    expect(stopped).toBe(html.lastIndexOf("<a"));
    expect(closingTag(html, "a", 0)).toEqual({ start: html.indexOf("</a>"), end: html.indexOf("</a>") + 4 });
    expect(closingTag(html, "a", html.lastIndexOf("</A>") + 1)).toBeNull();
    expect(closingTag("</abbr></a >", "a", 0)).toEqual({ start: 7, end: 12 });
  });

  it("removes comments and code, keeps JSON data blocks, and lets unclosed code take the rest", () => {
    expect(stripCode('a<!-- x <a href="1"> -->b<script>var x = "<a href=2>";</script>c<STYLE media="x">a{}</style >d<noscript><a href="3">n</a></noscript>e<template><a href="4">t</a></template>f')).toBe("a b c d e f");
    const data = '<script type="application/ld+json">{"a":"</b>"}</script>';
    const pageData = `<script type='application/json' id="__NEXT_DATA__">{}</script>`;
    expect(stripCode(`x${data}y${pageData}z`)).toBe(`x${data}y${pageData}z`);
    expect(stripCode('keep<script>never closed <a href="https://evil.example/">x</a>')).toBe("keep");
    expect(stripCode('keep<!-- never closed <a href="https://evil.example/">x</a>')).toBe("keep");
    expect(stripCode('keep<style x <a href="https://evil.example/"')).toBe("keep");
    expect(stripCode("plain text, no tags")).toBe("plain text, no tags");
  });

  it("strips tags without looking twice", () => {
    expect(stripTags("a <b>bold</b> c")).toBe("a  bold  c");
    expect(stripTags("1 < 2 and no end")).toBe("1 < 2 and no end");
    expect(stripTags("x<i>y</i> 3 < 4")).toBe("x y  3 < 4");
  });

  it("scans metas, the first title, data blocks, rel links and outermost anchors in one pass", () => {
    const scan = scanPage(
      '<title>One</title><title>Two</title><meta name="a" content="b"><link rel="me" href="https://m.example/@x">' +
        '<script type="application/ld+json">{"@type":"Person","name":"<a href=x>"}</script>' +
        '<script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>' +
        '<a name="top">no href</a><a href="/1">one <a href="/inner">inner</a> tail</a><a href="/2">two</a><a href="/3">never closed',
    );
    expect(scan.title).toBe("One");
    expect(scan.metas.map((attrs) => ({ ...attrs }))).toEqual([{ name: "a", content: "b" }]);
    expect(scan.jsonLd).toEqual(['{"@type":"Person","name":"<a href=x>"}']);
    expect(scan.nextData).toBe('{"props":{}}');
    expect(scan.anchors).toEqual([
      { href: "/1", inner: 'one <a href="/inner">inner' },
      { href: "/2", inner: "two" },
    ]);
    // Every <a> and <link> is there for rel="me", also the ones that are no anchors of their own.
    expect(scan.refs.map((attrs) => attrs.href ?? attrs.name)).toEqual(["https://m.example/@x", "top", "/1", "/inner", "/2", "/3"]);
  });
});

describe("pageLinks", () => {
  const page = new URL("https://bio.link/mila");

  it("answers like the importer's extractLinks on ordinary pages", () => {
    const anchors = `
      <a href="https://youtube.com/@mila">My <b>YouTube</b></a>
      <a href='https://shop.example.com/'>Merch</a>
      <a href="/signup">Create your own</a>
      <a href="https://bio.link/privacy">Privacy</a>
      <a href="https://apps.apple.com/app/id1">App</a>
      <a href="javascript:alert(1)">x</a>
      <a href="https://shop.example.com">Merch again</a>
      <a href="http://plain.example.com/a?b=1&amp;c=2">Plain &amp; simple</a>
      <a href="mailto:mila@example.com">Mail</a>`;
    expect(pageLinks(anchors, page)).toEqual(extractLinks(anchors, page));
    expect(pageLinks(anchors, page)).toHaveLength(4);
    const data = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          links: [
            { title: "New single &amp; video", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", type: "CLASSIC" },
            { title: "Tour", url: "https://tickets.example.com/mila", type: "CLASSIC" },
            { title: "Own", url: "https://bio.link/someone-else", type: "CLASSIC" },
            { title: "Tour again", url: "https://tickets.example.com/mila/", type: "CLASSIC" },
            null,
          ],
          socialLinks: [{ type: "INSTAGRAM", url: "https://instagram.com/mila.aurel" }],
        },
      },
    })}</script><a href="https://ignored.example/">only without page data</a></html>`;
    expect(pageLinks(data, page)).toEqual([
      { url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", title: "New single & video" },
      { url: "https://tickets.example.com/mila", title: "Tour" },
      { url: "https://instagram.com/mila.aurel", title: "INSTAGRAM" },
    ]);
  });

  it("keeps at most 40 links, none longer than an address can be, and none from comments or code", () => {
    const many = Array.from({ length: 60 }, (_, index) => `<a href="https://site${String(index)}.example/">Link ${String(index)}</a>`).join("");
    expect(pageLinks(many, page)).toHaveLength(40);
    expect(pageLinks(`<a href="https://long.example/${"a".repeat(2100)}">long</a><!-- <a href="https://comment.example/">c</a> --><script>'<a href="https://code.example/">s</a>'</script><a href="https://ok.example/">ok</a>`, page)).toEqual([
      { url: "https://ok.example/", title: "ok" },
    ]);
  });
});

// ssrf-2: a hostile page is 1 MiB after decoding (a few KB on the wire). Each of these took tens of
// seconds to minutes when every opener was searched to the end of the document again.
describe("a hostile page of 1 MiB", () => {
  const MiB = 1_048_576;
  const fill = (piece: string, length = MiB) => piece.repeat(Math.ceil(length / piece.length)).slice(0, length);
  const base = new URL("https://evil.example/");
  const timed = <T>(name: string, work: () => T): T => {
    const started = performance.now();
    const result = work();
    expect(performance.now() - started, name).toBeLessThan(200);
    return result;
  };

  it.each([
    ["comments that never end", "<!--"],
    ["scripts that never end", "<script>"],
    ["styles that never end", "<style>"],
    ["anchors without >", "<a "],
    ["anchors without </a>", '<a href="x">'],
    ["anchors without </a>, each to another site", '<a href="https://a.example/x">'],
    ["metas without >", "<meta "],
    ["links without >", "<link "],
    ["titles that never end", "<title>"],
    ["JSON-LD blocks that never end", '<script type="application/ld+json">'],
    ["page data blocks that never end", '<script id="__NEXT_DATA__" type="application/json">'],
    ["closed comments", "<!--x-->"],
    ["closed empty anchors", '<a href="/x"></a>'],
    ["closed anchors to other sites", '<a href="https://a.example/x">y</a>'],
    ["rel=me links", '<link rel="me" href="https://a.example/x">'],
    ["small JSON-LD blocks", '<script type="application/ld+json">{"@type":"Person","sameAs":["https://a.example/x"]}</script>'],
    ["only <", "<"],
    ["only &", "&"],
    ["entities that never end", "&amp"],
    ["slashes", "/"],
  ])("made of %s is read in well under 200 ms", (name, piece) => {
    const html = fill(piece);
    timed(`readPage: ${name}`, () => readPage(html, base));
    timed(`pageLinks: ${name}`, () => pageLinks(html, base));
  });

  it.each([
    ["one tag", (junk: string) => `<a ${junk} href="https://a.example/">x</a>`],
    ["one attribute value", (junk: string) => `<a title="${junk}" href="https://a.example/">x</a>`],
    ["one anchor text", (junk: string) => `<a href="https://a.example/">${junk}</a>`],
    ["one address", (junk: string) => `<a href="https://a.example/${junk}">x</a><link rel="me" href="https://a.example/${junk}">`],
    ["one title", (junk: string) => `<title>${junk}</title>`],
    ["one description", (junk: string) => `<meta name="description" content="${junk}">`],
    ["one JSON-LD name", (junk: string) => `<script type="application/ld+json">{"@type":"Person","name":"${junk}","sameAs":"https://a.example/${junk}"}</script>`],
  ])("with %s as long as the page is read in well under 200 ms", (name, make) => {
    for (const junk of ["a", "<", "& ", "/", "a=", "&#x", " "]) {
      const html = make(fill(junk, MiB - 200));
      timed(`readPage: ${name} of ${junk}`, () => readPage(html, base));
      timed(`pageLinks: ${name} of ${junk}`, () => pageLinks(html, base));
    }
  });

  it("reads a real page in front of the junk, and stops after its tag limit", () => {
    const real = '<title>Lio</title><meta name="description" content="DJ"><a href="https://soundcloud.com/lio" rel="me">SoundCloud</a>';
    const page = timed("real page, then junk", () => readPage(`${real}${fill("<a ", MiB - real.length)}`, base));
    expect(page).toMatchObject({ title: "Lio", description: "DJ", relMe: ["https://soundcloud.com/lio"], links: [{ url: "https://soundcloud.com/lio", title: "SoundCloud" }] });
    const late = `${'<link rel="x" href="/y">'.repeat(TAGS_MAX)}<a href="https://late.example/">late</a>`;
    expect(readPage(late, base).links).toEqual([]);
  });
});
