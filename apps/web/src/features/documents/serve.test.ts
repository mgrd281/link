import type { Page } from "@linkyo/blocks";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PublicPage } from "@/features/creator/public-page";

import { jonasDe, jonasEn, noLetter } from "./fixtures";
import { servePreviewDocument, servePublicDocument, type ServeDeps } from "./serve";
import { documentsView } from "./view";

const NOW = new Date("2026-11-26T10:00:00Z");
const base: ServeDeps = { now: () => NOW, photo: () => Promise.resolve(null) };
const latin1 = async (response: Response) => Array.from(new Uint8Array(await response.arrayBuffer()), (byte) => String.fromCharCode(byte)).join("");

const published = (page: Page = jonasDe(), template = "laufbahn"): PublicPage => ({
  page: { ...page, profile: { ...page.profile, username: "jonasbrandt" } },
  theme: { template: template as "laufbahn" },
  legal: {} as PublicPage["legal"],
  updatedAt: "2026-11-20T09:00:00.000Z",
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a prepared page's documents (/p)", () => {
  it("answers with the PDF, private and never indexed", async () => {
    const response = await servePreviewDocument("cv", "de", "jonas-brandt", base);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="Lebenslauf_Jonas_Brandt.pdf"; filename*=UTF-8''Lebenslauf_Jonas_Brandt.pdf`);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("etag")).toBeNull();
    const body = await latin1(response);
    expect(body.startsWith("%PDF-1.7")).toBe(true);
    expect(body.endsWith("%%EOF\n")).toBe(true);
  });

  it("names each document in the page's language", async () => {
    const letter = await servePreviewDocument("letter", "en", "jonas-brandt", base);
    expect(letter.headers.get("content-disposition")).toContain('filename="Cover_letter_Jonas_Brandt.pdf"');
    const both = await servePreviewDocument("application", "de", "jonas-brandt", base);
    expect(both.headers.get("content-disposition")).toContain('filename="Bewerbung_Jonas_Brandt.pdf"');
  });

  it("answers an empty, unindexed 404 for Arabic, other templates, unknown pages and documents not offered", async () => {
    const missing = [
      await servePreviewDocument("cv", "ar", "karim-nasser", base),
      await servePreviewDocument("cv", "de", "journalist", base),
      await servePreviewDocument("cv", "de", "nobody-here", base),
      await servePreviewDocument("cv", "fr", "jonas-brandt", base),
      await servePreviewDocument("letter", "de", "jonas-brandt", { ...base, find: () => ({ page: noLetter(), preview: { theme: { template: "laufbahn" } } }) }),
      await servePreviewDocument("application", "de", "jonas-brandt", { ...base, find: () => ({ page: noLetter(), preview: { theme: { template: "laufbahn" } } }) }),
    ];
    for (const response of missing) {
      expect(response.status).toBe(404);
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).toBe("");
    }
  });

  it("answers the same empty 404 for names an object inherits (constructor, toString, __proto__)", async () => {
    for (const slug of ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"]) {
      for (const kind of ["cv", "letter", "application"] as const) {
        const response = await servePreviewDocument(kind, "de", slug, { now: () => NOW });
        expect(response.status, `${slug}/${kind}`).toBe(404);
        expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
        expect(response.headers.get("cache-control")).toBe("no-store");
      }
    }
    // A prepared page under such a name in another language is no page either.
    expect((await servePreviewDocument("cv", "constructor", "jonas-brandt", base)).status).toBe(404);
  });

  it("answers an empty, unindexed 500 when the lookup itself fails", async () => {
    const response = await servePreviewDocument("cv", "de", "jonas-brandt", { ...base, find: () => { throw new Error("Jonas Brandt"); } });
    expect(response.status).toBe(500);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("logs nothing, not even on a failure", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) => vi.spyOn(console, method));
    await servePreviewDocument("cv", "de", "jonas-brandt", base);
    const failed = await servePreviewDocument("cv", "de", "jonas-brandt", { ...base, photo: () => Promise.reject(new Error("Jonas Brandt +49 30")) });
    expect(failed.status).toBe(500);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe("a public page's documents (/u)", () => {
  const request = (etag?: string) => new Request("https://linkyo.app/jonasbrandt/cv", etag ? { headers: { "if-none-match": etag } } : {});

  it("revalidates with an ETag and answers 304 when it matches", async () => {
    const deps = { ...base, load: () => Promise.resolve(published()) };
    const response = await servePublicDocument("cv", "jonasbrandt", request(), deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const etag = response.headers.get("etag") ?? "";
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/u);
    // The public address and the last save are printed on a public page's CV.
    expect(await latin1(response)).toContain("/URI (https://linkyo.app/jonasbrandt)");
    const again = await servePublicDocument("cv", "jonasbrandt", request(etag), deps);
    expect(again.status).toBe(304);
    expect(await again.text()).toBe("");
  });

  it("answers an empty, unindexed 500 when the page cannot be loaded", async () => {
    const response = await servePublicDocument("cv", "jonasbrandt", request(), { ...base, load: () => Promise.reject(new Error("database")) });
    expect(response.status).toBe(500);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 404 for an unknown page or another template", async () => {
    expect((await servePublicDocument("cv", "nobody", request(), { ...base, load: () => Promise.resolve(null) })).status).toBe(404);
    expect((await servePublicDocument("cv", "jonasbrandt", request(), { ...base, load: () => Promise.resolve(published(jonasDe(), "nocturne")) })).status).toBe(404);
  });
});

describe("what the page shows of its documents", () => {
  it("gives addresses, file names, real page counts and miniatures", async () => {
    const view = await documentsView(jonasDe(), { base: "/de/p/jonas-brandt", signposted: true, now: NOW, asOf: null, publicAddress: null });
    expect(view?.cv).toMatchObject({ kind: "cv", href: "/de/p/jonas-brandt/cv", filename: "Lebenslauf_Jonas_Brandt.pdf", pages: 1 });
    expect(view?.cv?.miniature?.length).toBeGreaterThan(20);
    expect(view?.letter).toMatchObject({ href: "/de/p/jonas-brandt/letter", filename: "Anschreiben_Jonas_Brandt.pdf", pages: 1 });
    expect(view?.application).toMatchObject({ href: "/de/p/jonas-brandt/application", filename: "Bewerbung_Jonas_Brandt.pdf", pages: 2, miniature: null });
    expect(view?.subject).toBe("Bewerbung als Fachkraft für Lagerlogistik (m/w/d)");
    expect(view?.ownCv).toBeNull();
    expect(JSON.stringify(view)).not.toMatch(/example\.com|\+49|23125/u);
  });

  it("is null on pages without documents", async () => {
    const page = jonasEn();
    expect(await documentsView({ ...page, profile: { ...page.profile, locale: "ar" } }, { base: "/x", signposted: true, now: NOW, asOf: null, publicAddress: null })).toBeNull();
    expect(await documentsView(page, { base: "/x", signposted: false, now: NOW, asOf: null, publicAddress: null })).toBeNull();
  });
});
