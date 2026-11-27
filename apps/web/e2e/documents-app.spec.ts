import { expect, test } from "@playwright/test";

/**
 * The application's PDFs (features/documents, ADR 0089), on the fictional applicant's
 * example page only (Jonas Brandt, Karim Nasser: features/previews/application-sample.ts). Never on
 * a real person's page. Each answer is a real PDF with the person's name in its text, private
 * (no shared cache) and never indexed; Arabic pages and other templates have none.
 */

const PDFS = [
  { path: "/de/p/jonas-brandt/cv", file: "Lebenslauf_Jonas_Brandt.pdf", pages: 1, title: "Lebenslauf" },
  { path: "/de/p/jonas-brandt/letter", file: "Anschreiben_Jonas_Brandt.pdf", pages: 1, title: "Anschreiben" },
  { path: "/de/p/jonas-brandt/application", file: "Bewerbung_Jonas_Brandt.pdf", pages: 2, title: "Bewerbung" },
  { path: "/en/p/jonas-brandt/cv", file: "CV_Jonas_Brandt.pdf", pages: 1, title: "CV" },
  { path: "/en/p/jonas-brandt/letter", file: "Cover_letter_Jonas_Brandt.pdf", pages: 1, title: "Cover letter" },
];

const latin1 = (bytes: Buffer): string => bytes.toString("latin1");

for (const pdf of PDFS) {
  test(`${pdf.path}: a private, unindexed PDF named ${pdf.file}`, async ({ request }) => {
    const response = await request.get(pdf.path);
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers["content-type"]).toBe("application/pdf");
    expect(headers["content-disposition"]).toBe(`attachment; filename="${pdf.file}"; filename*=UTF-8''${pdf.file}`);
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(headers["cache-control"]).toBe("private, no-store");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers.etag).toBeUndefined();
    expect(headers["set-cookie"]).toBeUndefined();
    // No hreflang alternates: an attachment in one language (next-intl would list /ar/p/<slug>/cv, a 404).
    expect(headers.link).toBeUndefined();
    const body = await response.body();
    const text = latin1(body);
    expect(text.startsWith("%PDF-1.7\n")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
    expect(body.length).toBeLessThanOrEqual(250 * 1024);
    // The name is in the document's information and, as text, in its first page's content.
    expect(text).toContain(`/Author (Jonas Brandt)`);
    expect(text).toMatch(new RegExp(`/Title \\(${pdf.title} \\\\205 Jonas Brandt\\)`, "u"));
    expect(text.match(/\/Type \/Page /gu)).toHaveLength(pdf.pages);
    expect(text).toContain("/Encoding /WinAnsiEncoding");
    // A prepared page prints no public address.
    expect(text).not.toContain("linkyo.app/");
  });
}

test("Arabic pages, other templates and unknown pages have no PDFs", async ({ request }) => {
  for (const path of ["/ar/p/karim-nasser/cv", "/ar/p/karim-nasser/letter", "/de/p/journalist/cv", "/de/p/nobody-at-all/cv", "/en/p/journalist/application"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
    expect(response.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
  }
});

test("the example page itself still renders", async ({ request }) => {
  for (const path of ["/de/p/jonas-brandt", "/en/p/jonas-brandt", "/ar/p/karim-nasser"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    // The page keeps the alternates next-intl lists (only its PDFs drop them).
    expect(response.headers().link, path).toContain('hreflang="ar"');
  }
});
