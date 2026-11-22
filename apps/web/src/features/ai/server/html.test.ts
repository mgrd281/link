import { describe, expect, it } from "vitest";

import { decodeText, readPage } from "./html";

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
