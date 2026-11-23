import { MAX_PROJECTS, type Block, type BlockOf } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { inPage, PAGE_SIZE_WARNING, storedSize, validateBlock, validatePage } from "./validate";

type Project = BlockOf<"project">;
const base = { visible: true, highlight: false } as const;
const project = (patch: Partial<Project> = {}): Project => ({ ...base, id: "p1", type: "project", slug: "hafenlicht", title: "Hafenlicht", summary: "Der Hafen bei Nacht.", ...patch });
const contact = (id = "c1"): BlockOf<"contact"> => ({ ...base, id, type: "contact", title: "Ein Projekt im Kopf?", primary: { label: "Nachricht schreiben", url: "mailto:hallo@example.com" } });
const quote = { text: "Klar und pünktlich.", name: "M. K.", role: "Geschäftsführerin, Bäckerei", consent: true as const };
const profile = { username: "ronja", displayName: "Ronja", bio: "", verified: false, locale: "de" as const, avatar: { src: "none:", alt: "" } };

describe("validateBlock: the errors of a project", () => {
  it("accepts a title and one sentence", () => {
    expect(validateBlock(project())).toBeNull();
  });

  it("needs a title and a sentence", () => {
    expect(validateBlock(project({ title: "" }))?.title).toBe("required");
    expect(validateBlock(project({ summary: "" }))?.summary).toBe("required");
    // Spaces alone are no title and no sentence (the card would have no name).
    expect(validateBlock(project({ title: "   " }))?.title).toBe("required");
    expect(validateBlock(project({ title: " \t" }))?.title).toBe("required");
    expect(validateBlock(project({ summary: " " }))?.summary).toBe("required");
  });

  it("refuses an end before the start", () => {
    expect(validateBlock(project({ year: { from: 2024, to: 2021 } }))?.["year.to"]).toBe("portfolio.yearOrder");
    expect(validateBlock(project({ year: { from: 2021, to: "now" } }))).toBeNull();
  });

  it("does not ask for a year", () => {
    expect(validateBlock(project({ year: undefined }))).toBeNull();
  });

  it("refuses more than 30 lines of code", () => {
    const lines = (n: number) => Array.from({ length: n }, (_, i) => `const line${String(i)} = ${String(i)};`).join("\n");
    expect(validateBlock(project({ code: { text: lines(30), lang: "ts" } }))).toBeNull();
    expect(validateBlock(project({ code: { text: `${lines(30)}\n`, lang: "ts" } }))).toBeNull();
    expect(validateBlock(project({ code: { text: lines(31), lang: "ts" } }))?.["code.text"]).toBe("portfolio.codeTooLong");
  });

  it("refuses an address that is reserved, malformed or taken by another project", () => {
    expect(validateBlock(project({ slug: "kontakt" }))?.slug).toBe("portfolio.slugReserved");
    expect(validateBlock(project({ slug: "Hafen Licht" }))?.slug).toBe("portfolio.slugInvalid");
    const other = project({ id: "p2", slug: "hafenlicht" });
    expect(validateBlock(inPage(project(), [other]))?.slug).toBe("portfolio.slugTaken");
    // Another project's earlier address can be taken over (the editor confirms it in one line).
    const older = project({ id: "p2", slug: "harbour", was: ["hafenlicht"] });
    expect(validateBlock(inPage(project(), [older]))).toBeNull();
  });

  it("refuses an address typed into the sheet that cannot be used, so Save does not drop it quietly", () => {
    // The Address field puts what was typed into the draft even when it shows a problem.
    const saved = project();
    expect(validateBlock(inPage(project({ slug: "kontakt", was: ["hafenlicht"] }), [saved]))?.slug).toBe("portfolio.slugReserved");
    const other = project({ id: "p2", slug: "harbour" });
    expect(validateBlock(inPage(project({ slug: "harbour" }), [saved, other]))?.slug).toBe("portfolio.slugTaken");
    expect(validateBlock(inPage(project({ slug: "x" }), [saved]))?.slug).toBe("portfolio.slugInvalid");
  });

  it("refuses a 25th project", () => {
    const page = Array.from({ length: MAX_PROJECTS }, (_, i) => project({ id: `p${String(i + 10)}`, slug: `projekt-${String(i + 10)}` }));
    expect(validateBlock(inPage(project({ id: "new" }), page))?.page).toBe("portfolio.tooMany");
    // Editing one of the 24 is fine.
    expect(validateBlock(inPage(page[0] as Block, page))).toBeNull();
  });

  it("does not treat a picture without a description as an error, and leaves `visible` alone", () => {
    const withPicture = project({ pictures: [{ image: { src: "data:image/jpeg;base64,AA", alt: "", w: 1080, h: 720 } }] });
    expect(validateBlock(withPicture)).toBeNull();
    expect(withPicture.visible).toBe(true);
    expect(validateBlock(project({ cover: { src: "data:image/jpeg;base64,AA", alt: "" } }))).toBeNull();
  });
});

describe("validateBlock: the other portfolio blocks", () => {
  it("refuses a second contact block", () => {
    expect(validateBlock(inPage(contact("c2"), [contact("c1")]))?.page).toBe("portfolio.oneContact");
    // The page's own contact block, edited.
    expect(validateBlock(inPage(contact("c1"), [contact("c1")]))).toBeNull();
  });

  it("needs a quote's name, role and consent", () => {
    const quotes = (item: Record<string, unknown>): Block => ({ ...base, id: "q", type: "quotes", items: [{ ...quote, ...item }] });
    expect(validateBlock(quotes({}))).toBeNull();
    expect(validateBlock(quotes({ name: "" }))?.["items.0.name"]).toBe("required");
    expect(validateBlock(quotes({ role: "" }))?.["items.0.role"]).toBe("required");
    expect(validateBlock(quotes({ consent: false }))?.["items.0.consent"]).toBe("portfolio.quotes.consentMissing");
  });

  it("refuses an end before the start on the timeline", () => {
    const timeline: Block = { ...base, id: "t", type: "timeline", items: [{ role: "Fotografin", years: { from: 2024, to: 2020 } }] };
    expect(validateBlock(timeline)?.["items.0.years.to"]).toBe("portfolio.yearOrder");
  });

  it("needs another way's address to be what its kind builds", () => {
    const ways = (links: NonNullable<BlockOf<"contact">["links"]>): Block => ({ ...contact(), links });
    expect(validateBlock(ways([{ kind: "whatsapp", url: "https://wa.me/4915123456789" }, { kind: "email", url: "mailto:hallo@example.com" }, { kind: "phone", url: "tel:+49301234567" }]))).toBeNull();
    expect(validateBlock(ways([{ kind: "calendar", url: "https://cal.example.com/ronja" }, { kind: "cv", url: "https://example.com/cv.pdf" }, { kind: "link", url: "https://example.com" }]))).toBeNull();
    // A number under WhatsApp that became a phone call, and a dead wa.me link without a country code.
    expect(validateBlock(ways([{ kind: "whatsapp", url: "tel:+4915123456789" }]))?.["links.0.url"]).toBe("invalid");
    expect(validateBlock(ways([{ kind: "whatsapp", url: "https://wa.me/01512345678" }]))?.["links.0.url"]).toBe("invalid");
    // An e-mail address under "Phone", a phone number under "E-mail".
    expect(validateBlock(ways([{ kind: "email", url: "https://example.com" }, { kind: "phone", url: "mailto:a@b.de" }]))).toEqual({ "links.0.url": "invalidEmail", "links.1.url": "invalid" });
  });

  it("lets clients be names without logos", () => {
    expect(validateBlock({ ...base, id: "b", type: "brands", title: "Kunden", columns: 3, items: [{ name: "Bäckerei Sonnenschein" }] })).toBeNull();
  });
});

describe("validatePage", () => {
  it("names the page's rule breaks", () => {
    const page = { profile, blocks: [project(), project({ id: "p2" }), contact("c1"), contact("c2")] };
    expect(validatePage({ page }, { real: false })).toEqual(["oneContact", "slugTaken"]);
    const many = { profile, blocks: Array.from({ length: MAX_PROJECTS + 1 }, (_, i) => project({ id: `p${String(i)}`, slug: `projekt-${String(i + 1)}` })) };
    expect(validatePage({ page: many }, { real: false })).toEqual(["tooMany"]);
  });

  it("warns about the size with a real account from 800,000 bytes of text", () => {
    const text = "x".repeat(600);
    const blocks: Block[] = Array.from({ length: 1400 }, (_, i) => ({ ...base, id: `t${String(i)}`, type: "text", text }));
    const page = { profile, blocks };
    expect(storedSize({ page })).toBeGreaterThanOrEqual(PAGE_SIZE_WARNING);
    expect(validatePage({ page }, { real: true })).toContain("pageSize");
    const small = { profile, blocks: blocks.slice(0, 100) };
    expect(validatePage({ page: small }, { real: true })).not.toContain("pageSize");
  });

  it("measures what a real account stores: the page, its look and its legal details", () => {
    const page = { profile, blocks: [project()] };
    const legal = { name: "Ronja Feldkamp", address: "Am Hafen 1, 20457 Hamburg", email: "hallo@example.com", phone: "" };
    expect(storedSize({ page, theme: { template: "werkbogen" }, legal })).toBeGreaterThan(storedSize({ page, theme: { template: "werkbogen" } }));
    expect(storedSize({ page, theme: { template: "werkbogen" }, legal })).toBe(new TextEncoder().encode(JSON.stringify([page, { template: "werkbogen" }, legal])).length);
  });

  it("measures nothing in the demo, where six pictures are data URLs inside the page", () => {
    const picture = `data:image/jpeg;base64,${"A".repeat(250_000)}`;
    const heavy = project({ cover: { src: picture, alt: "" }, pictures: Array.from({ length: 5 }, () => ({ image: { src: picture, alt: "" } })) });
    const page = { profile, blocks: [heavy] };
    expect(JSON.stringify(page).length).toBeGreaterThan(PAGE_SIZE_WARNING);
    expect(validatePage({ page }, { real: false })).toEqual([]);
    // Data URLs do not count for real accounts either (they upload pictures to Storage).
    expect(storedSize({ page })).toBeLessThan(PAGE_SIZE_WARNING);
  });
});
