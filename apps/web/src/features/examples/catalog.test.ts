import { readFileSync } from "node:fs";
import path from "node:path";

import { coverImage, coverMode, hasDetail, pageSchema, repositoryUrl, shownPictures, type Block, type BlockOf, type Page } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import { auditPalette, resolveCreatorTheme } from "@linkyo/tokens/creator";
import { describe, expect, it } from "vitest";

import { PREVIEWS } from "@/features/previews/registry";

import { EXAMPLES } from "./catalog";
import { GALLERY_LEAD, LOOKS, type Look } from "./looks";

/**
 * Every address a block leads to. A project's repository address is not stored: pages derive it
 * from the repository facts (`source`), so it is derived here the same way.
 */
const urls = (block: Block): string[] => {
  switch (block.type) {
    case "link":
    case "card":
    case "video":
    case "product":
      return [block.url];
    case "socials":
    case "events":
      return block.items.map((item) => item.url);
    case "music":
      return block.links.map((item) => item.url);
    case "live":
    case "repo":
      return [block.url];
    case "app":
      return block.stores.map((store) => store.url);
    case "project":
      return [...(block.links ?? []).map((link) => link.url), ...(block.source ? [repositoryUrl(block.source)] : [])];
    case "contact":
      return [block.primary.url, ...(block.links ?? []).map((link) => link.url)];
    case "timeline":
    case "brands":
      return block.items.flatMap((item) => (item.url ? [item.url] : []));
    case "image":
      return block.url ? [block.url] : [];
    default:
      return [];
  }
};

/** Every stored string that starts like an address, wherever it sits in a block. */
const addressLike = (value: unknown): string[] => {
  if (typeof value === "string") return /^(https?:|mailto:|tel:)/.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(addressLike);
  return value !== null && typeof value === "object" ? Object.values(value).flatMap(addressLike) : [];
};

/**
 * Where an example may lead: example.com, a mailbox there, a number that cannot be dialled, or a
 * repository whose owner ends in ".example". GitHub names hold letters, digits and dashes only, so
 * such an owner can never be registered and the address can never reach someone's real code.
 */
const EXAMPLE_ADDRESS = /^(https:\/\/example\.com\/|mailto:[a-z]+@example\.com$|tel:\+49300000000$|https:\/\/github\.com\/[a-z0-9-]+\.example\/[a-z0-9-]+$)/;

const PORTFOLIOS = ["ronja-feldkamp", "tobin-achterberg", "naya-aldabbas", "jorinde-ahlfeld"] as const;
/** One example person per Stage 3 template (catalog-i.ts). */
const STAGE3 = ["merle-kastorf", "rana-al-khatib", "ines-vasconcelos"] as const;
const ALL_PORTFOLIOS = [...PORTFOLIOS, ...STAGE3] as const;
const SW = creatorTokens.swatches;

const projectsOf = (page: Page): BlockOf<"project">[] => page.blocks.filter((block): block is BlockOf<"project"> => block.type === "project");
const quotesOf = (page: Page): BlockOf<"quotes">[] => page.blocks.filter((block): block is BlockOf<"quotes"> => block.type === "quotes");
const example = (slug: string): Page => {
  const page = EXAMPLES[slug];
  if (!page) throw new Error(`no example page "${slug}"`);
  return page;
};

/** File name → who made it, from the table in CREDITS.md ("| ex-pf-ronja-02.jpg | Paul Einerhand (…) | … |"). */
const CREDITS = new Map(
  readFileSync(path.resolve(import.meta.dirname, "../../assets/examples/CREDITS.md"), "utf8")
    .split("\n")
    .flatMap((line): [string, string][] => {
      const cells = line.split("|").map((cell) => cell.trim());
      const file = cells[1];
      const maker = cells[2];
      return file?.startsWith("ex-pf-") && file.endsWith(".jpg") && maker ? [[file.replace(/\.jpg$/, ""), maker.replace(/\s*\(.*$/, "")]] : [];
    }),
);

/** The bundled portfolio pictures a set of values uses ("sample:ex-pf-ronja-06" → "ex-pf-ronja-06"). */
const pictures = (value: unknown): string[] => {
  if (typeof value === "string") return value.startsWith("sample:ex-pf-") ? [value.slice("sample:".length)] : [];
  if (Array.isArray(value)) return value.flatMap(pictures);
  return value !== null && typeof value === "object" ? Object.values(value).flatMap(pictures) : [];
};

describe("example gallery", () => {
  it("has about forty examples, each with a page in its own language", () => {
    const slugs = Object.keys(LOOKS).filter((slug) => slug !== "journalist");
    expect(slugs.length).toBeGreaterThanOrEqual(40);
    for (const slug of slugs) {
      const page = EXAMPLES[slug];
      expect(page, slug).toBeDefined();
      expect(page?.profile.locale, slug).toBe(LOOKS[slug as keyof typeof LOOKS].locale);
    }
  });

  it("every page is valid and links only to example addresses (the people are fictional)", () => {
    for (const [slug, page] of Object.entries(EXAMPLES)) {
      expect(pageSchema.safeParse(page).success, slug).toBe(true);
      expect(page.profile.verified, slug).toBe(false);
      for (const block of page.blocks) {
        const seen = urls(block);
        // The guard: an address stored anywhere in a block that the collector above does not return
        // (a new block type that falls through to `default`, a new field of an old one) fails here.
        for (const stored of addressLike(block)) expect(seen, `${slug}: ${block.type} holds ${stored}, which this test does not check`).toContain(stored);
        for (const url of seen) expect(url, `${slug}: ${url}`).toMatch(EXAMPLE_ADDRESS);
      }
      // Install commands too: a fictional page must never install someone's real code.
      for (const block of page.blocks) {
        if (block.type === "repo" && block.install) expect(block.install, slug).toMatch(/^npx skills add https:\/\/example\.com\//);
        if (block.type === "project" && block.source?.install) expect(block.source.install, slug).toMatch(/^npm install https:\/\/example\.com\/\S+$/);
      }
    }
  });

  it("the collector sees the links of the portfolio blocks (project, contact, timeline)", () => {
    const blocks = PORTFOLIOS.flatMap((slug) => example(slug).blocks);
    const seen = (type: Block["type"]) => blocks.filter((block) => block.type === type).flatMap(urls);
    // Project links, and the repository address of a project with repository facts.
    expect(seen("project")).toContain("https://example.com/tobin-achterberg/plotweft/docs");
    expect(seen("project")).toContain("https://github.com/achterberg.example/plotweft");
    // The primary action and the other ways to reach someone.
    expect(seen("contact")).toContain("https://example.com/naya-aldabbas/booking");
    expect(seen("contact")).toContain("mailto:hello@example.com");
    expect(seen("contact")).toContain("tel:+49300000000");
    expect(seen("contact")).toContain("https://example.com/ronja-feldkamp/vita.pdf");
    expect(seen("timeline")).toEqual(["https://example.com/tobin-achterberg/studio"]);
    // The guard itself: a block whose address the collector misses is found.
    expect(addressLike({ type: "future", items: [{ href: "https://elsewhere.test/x" }] })).toEqual(["https://elsewhere.test/x"]);
  });

  it("each portfolio page writes to one mailbox, from the icon row and from its main button alike", () => {
    for (const slug of ALL_PORTFOLIOS) {
      const mail = new Set(example(slug).blocks.flatMap(urls).filter((url) => url.startsWith("mailto:")));
      expect(mail.size, `${slug}: ${[...mail].join(", ")}`).toBeLessThanOrEqual(1);
    }
  });

  it("no two examples share the same look", () => {
    const looks = Object.values(LOOKS).map((look) => JSON.stringify(look.theme));
    expect(new Set(looks).size).toBe(looks.length);
  });
});

describe("portfolio examples", () => {
  it("four pages on the two portfolio templates, in their categories, with palettes that pass the audit", () => {
    const expected: Record<(typeof PORTFOLIOS)[number], [template: string, category: Look["category"], locale: Look["locale"]]> = {
      // All four in the gallery's Portfolio category (the /portfolio page reads it).
      "ronja-feldkamp": ["werkbogen", "portfolio", "de"],
      "tobin-achterberg": ["tiefdruck", "portfolio", "en"],
      "naya-aldabbas": ["werkbogen", "portfolio", "ar"],
      "jorinde-ahlfeld": ["tiefdruck", "portfolio", "de"],
    };
    for (const slug of PORTFOLIOS) {
      const look: Look = LOOKS[slug];
      const page = example(slug);
      expect(pageSchema.safeParse(page).success, slug).toBe(true);
      expect([look.theme.template, look.category, look.locale], slug).toEqual(expected[slug]);
      expect(page.profile.locale, slug).toBe(look.locale);
      // A portfolio opens with the work (or with type): the portrait is never a hero picture.
      expect(page.profile.hero, slug).toBeUndefined();
      const theme = resolveCreatorTheme(look.theme, { rtlScript: look.locale === "ar" });
      expect(theme.template, slug).toBe(look.theme.template);
      const failed = auditPalette(theme.palette).filter((check) => !check.pass);
      expect(failed, `${slug}: ${failed.map((check) => check.pair).join(", ")}`).toEqual([]);
    }
  });

  it("the carpenter's accent is brass and her layout is her own choice; no new page uses an orange", () => {
    const theme = resolveCreatorTheme(LOOKS["jorinde-ahlfeld"].theme);
    expect(LOOKS["jorinde-ahlfeld"].theme.accent).toBe(SW.brass);
    expect(theme.layout.projects).toBe("bento");
    expect(resolveCreatorTheme(LOOKS["tobin-achterberg"].theme).layout.projects).toBe("list");
    const oranges: string[] = [SW.marigold, SW.honey, SW.tangerine, SW.apricot, SW.flame];
    for (const slug of PORTFOLIOS) expect(oranges, slug).not.toContain((LOOKS[slug] as Look).theme.accent);
  });

  it("each page shows what it is in the gallery for", () => {
    const ronja = example("ronja-feldkamp");
    const series = projectsOf(ronja);
    expect(series).toHaveLength(4);
    // The lead series: a cover and eleven pictures, each described and captioned, so all twelve show.
    const lead = series[0];
    expect(lead?.slug).toBe("hafenlicht");
    expect(lead ? shownPictures(lead) : []).toHaveLength(11);
    expect(lead?.pictures?.every((picture) => picture.caption && picture.image.alt && picture.image.w && picture.image.h)).toBe(true);
    expect(lead ? coverImage(lead)?.src : undefined).toBe("sample:ex-pf-ronja-06");
    // One confidential client, and so no stored name for it.
    expect(series.filter((project) => project.confidential).map((project) => project.client)).toEqual([undefined]);
    // Clients as names: a partner block without a single logo.
    const clients = ronja.blocks.find((block): block is BlockOf<"brands"> => block.type === "brands");
    expect(clients?.items.every((item) => item.logo === undefined)).toBe(true);
    // One quote, about a project of the page.
    const quoted = quotesOf(ronja).flatMap((block) => block.items);
    expect(quoted).toHaveLength(1);
    expect(series.map((project) => project.id)).toContain(quoted[0]?.project);

    const tobin = example("tobin-achterberg");
    const code = projectsOf(tobin).find((project) => project.slug === "plotweft");
    expect(code?.source?.owner).toBe("achterberg.example");
    expect(code?.code?.text.split("\n")).toHaveLength(12);
    expect(tobin.profile.stats?.length).toBeGreaterThan(0);
    expect(tobin.blocks.some((block) => block.type === "repo")).toBe(true);
    expect(tobin.blocks.some((block) => block.type === "tools")).toBe(true);
    expect(tobin.blocks.some((block) => block.type === "timeline")).toBe(true);
    // A figure cover (results, no picture) and a title cover (neither).
    expect(projectsOf(tobin).some((project) => !coverImage(project) && (project.results?.length ?? 0) > 0)).toBe(true);
    expect(projectsOf(tobin).some((project) => !coverImage(project) && !project.results)).toBe(true);

    const naya = example("naya-aldabbas");
    // Werkbogen without a single work picture; the first story's cover is its figure.
    expect(projectsOf(naya).some((project) => coverImage(project))).toBe(false);
    expect(projectsOf(naya)[0]?.results?.[0]).toEqual({ value: "8", label: "أشهر" });
    // The talk is a thin project: a title, a sentence and a link, so its card opens the link.
    const talk = projectsOf(naya).find((project) => project.slug === "cv-is-not-your-story");
    expect(talk && hasDetail(talk, quotesOf(naya))).toBe(false);
    expect(talk?.links).toHaveLength(1);
    expect(naya.blocks.find((block): block is BlockOf<"contact"> => block.type === "contact")?.steps).toHaveLength(3);
    // Latin digits everywhere, also in Arabic text.
    expect(JSON.stringify(naya)).not.toMatch(/[٠-٩۰-۹]/);

    const jorinde = example("jorinde-ahlfeld");
    expect(projectsOf(jorinde)).toHaveLength(3);
    expect(projectsOf(jorinde).every((project) => coverImage(project))).toBe(true);
    const about = jorinde.blocks.find((block): block is BlockOf<"about"> => block.type === "about");
    expect(about?.portrait?.alt).toBeTruthy();
    expect(about?.facts?.length).toBeGreaterThan(0);
  });

  it("the three project pages the performance budgets name have something to read", () => {
    const pages: [slug: (typeof PORTFOLIOS)[number], project: string][] = [
      ["ronja-feldkamp", "hafenlicht"],
      ["naya-aldabbas", "accountant-to-analyst"],
      ["tobin-achterberg", "plotweft"],
    ];
    for (const [slug, address] of pages) {
      const page = example(slug);
      const project = projectsOf(page).find((candidate) => candidate.slug === address);
      expect(project && hasDetail(project, quotesOf(page)), `${slug}/${address}`).toBe(true);
    }
  });

  it("every picture is in CREDITS.md, a series comes from one photographer, and the page names them", () => {
    for (const slug of ALL_PORTFOLIOS) {
      const look: Look = LOOKS[slug];
      const page = example(slug);
      const used = pictures(page);
      expect(used.length, slug).toBeGreaterThan(0);
      for (const file of used) {
        const maker = CREDITS.get(file);
        expect(maker, `${file} is missing from CREDITS.md`).toBeTruthy();
        // Our own drawings need no credit line; every photograph's author is named on the page.
        if (maker && !maker.startsWith("Original Linkyo")) expect(look.credit, `${slug}: ${file}`).toContain(maker);
      }
      for (const project of projectsOf(page)) {
        const makers = new Set(pictures(project).map((file) => CREDITS.get(file)));
        expect(makers.size, `${slug}/${project.slug}`).toBeLessThanOrEqual(1);
      }
      // The example route reads the credit from the preview.
      expect(PREVIEWS[slug]?.sample?.credit, slug).toBe(look.credit);
    }
    // The two pages whose work is photographs.
    expect(LOOKS["ronja-feldkamp"].credit).toContain("Paul Einerhand");
    expect(LOOKS["jorinde-ahlfeld"].credit).toContain("Caroline Badran");
  });
});

describe("Stage 3 portfolio examples (one person per new template)", () => {
  const NAME_CHECK = readFileSync(path.resolve(import.meta.dirname, "name-check.md"), "utf8");

  it("each sits on its template as it comes, in the Portfolio category, in its language, with an audited palette", () => {
    const expected: Record<(typeof STAGE3)[number], [template: string, kind: Look["kind"], locale: Look["locale"]]> = {
      "merle-kastorf": ["leuchttisch", "photographer", "de"],
      "rana-al-khatib": ["grundriss", "designer", "ar"],
      "ines-vasconcelos": ["logbuch", "engineer", "en"],
    };
    for (const slug of STAGE3) {
      const look: Look = LOOKS[slug];
      const page = example(slug);
      expect([look.theme.template, look.kind, look.locale], slug).toEqual(expected[slug]);
      expect(look.category, slug).toBe("portfolio");
      // The template as it comes: "Start with Leuchttisch" on /portfolio starts from this page.
      expect(Object.keys(look.theme), slug).toEqual(["template"]);
      expect(page.profile.locale, slug).toBe(look.locale);
      expect(page.profile.hero, slug).toBeUndefined();
      const theme = resolveCreatorTheme(look.theme, { rtlScript: look.locale === "ar" });
      const failed = auditPalette(theme.palette).filter((check) => !check.pass);
      expect(failed, `${slug}: ${failed.map((check) => check.pair).join(", ")}`).toEqual([]);
      // Every project has a page of its own to open, with something to read on it.
      for (const project of projectsOf(page)) expect(hasDetail(project, quotesOf(page)), `${slug}/${project.slug}`).toBe(true);
      // One primary action, in the closing contact band.
      expect(page.blocks.filter((block) => block.type === "contact"), slug).toHaveLength(1);
      // The gallery opens with them, after the older portfolio pages.
      expect(GALLERY_LEAD, slug).toContain(slug);
    }
  });

  it("Merle (Leuchttisch): four series whose covers differ in ratio, the lead one with fourteen pictures", () => {
    const merle = example("merle-kastorf");
    const series = projectsOf(merle);
    expect(series.map((project) => project.slug)).toEqual(["nachbild", "gegenlicht", "nathan-portraets", "spielzeitkampagne"]);
    // The strip hero shows the first covers side by side at their own ratios: landscape and portrait both.
    const ratios = series.map((project) => {
      const cover = coverImage(project);
      return cover?.w && cover.h ? cover.w / cover.h : 0;
    });
    expect(ratios.every((ratio) => ratio > 0)).toBe(true);
    expect(ratios.some((ratio) => ratio > 1.2)).toBe(true);
    expect(ratios.some((ratio) => ratio < 0.8)).toBe(true);
    // The lead series: its cover and thirteen pictures, each described and captioned.
    const lead = series[0];
    expect(lead ? shownPictures(lead).length + 1 : 0).toBe(14);
    expect(lead?.pictures?.every((picture) => picture.caption && picture.image.alt && picture.image.w && picture.image.h)).toBe(true);
    // Wider than the text column at the wall width: the series is stored at 2,240 px.
    expect(lead?.pictures?.every((picture) => Math.max(picture.image.w ?? 0, picture.image.h ?? 0) >= 2240)).toBe(true);
    // A confidential commission stores no client; the one quote is about a series of the page.
    expect(series.filter((project) => project.confidential).map((project) => project.client)).toEqual([undefined]);
    const quoted = quotesOf(merle).flatMap((block) => block.items);
    expect(quoted).toHaveLength(1);
    expect(series.map((project) => project.id)).toContain(quoted[0]?.project);
    expect(merle.blocks.find((block): block is BlockOf<"contact"> => block.type === "contact")?.primary.label).toBe("Probenbesuch anfragen");
  });

  it("Rana (Grundriss): an architect's sheets with figures, a confidential study and a title cover, Latin digits in Arabic", () => {
    const rana = example("rana-al-khatib");
    const projects = projectsOf(rana);
    expect(projects.map((project) => coverMode(project))).toEqual(["picture", "picture", "picture", "title"]);
    expect(projects[0]?.results?.[0]).toEqual({ value: "1,240 م²", label: "مساحة التوسعة" });
    expect(projects[0]?.year).toEqual({ from: 2024 });
    expect(projects.filter((project) => project.confidential).map((project) => project.slug)).toEqual(["housing-study"]);
    // Latin digits everywhere, also in Arabic text (Grundriss isolates them in <bdi>).
    expect(JSON.stringify(rana)).not.toMatch(/[٠-٩۰-۹]/);
    expect(rana.blocks.find((block): block is BlockOf<"tools"> => block.type === "tools")?.items).toEqual(expect.arrayContaining(["Revit", "Rhino"]));
    expect(rana.blocks.find((block): block is BlockOf<"contact"> => block.type === "contact")?.primary.label).toBe("احجز موعدًا");
    expect(rana.blocks.some((block) => block.type === "timeline")).toBe(true);
  });

  it("Ines (Logbuch): a build log over three years, running and done, with sources, a code sample and a repo block", () => {
    const ines = example("ines-vasconcelos");
    const projects = projectsOf(ines);
    // logGroups() groups by year.from; "running" when year.to is "now".
    expect(new Set(projects.map((project) => project.year?.from))).toEqual(new Set([2025, 2024, 2023]));
    expect(projects.filter((project) => project.year?.to === "now").map((project) => project.slug)).toEqual(["nevoa", "remendo-log"]);
    expect(projects.find((project) => project.slug === "bike-light-mount")?.year?.to).toBeUndefined();
    const sources = projects.flatMap((project) => (project.source ? [project.source] : []));
    expect(sources.map((source) => source.repo)).toEqual(["nevoa-epd", "remendo-log", "sardinha-split"]);
    for (const source of sources) expect(source.owner).toBe("vasconcelos.example");
    expect(projects[0]?.code?.text.split("\n")).toHaveLength(12);
    // The README hero reads the first four tools as the stack.
    expect(ines.blocks.find((block): block is BlockOf<"tools"> => block.type === "tools")?.items.slice(0, 4)).toEqual(["C", "ESP-IDF", "Zephyr", "KiCad"]);
    expect(ines.blocks.some((block) => block.type === "repo")).toBe(true);
    expect(ines.blocks.some((block) => block.type === "timeline")).toBe(true);
    expect(ines.blocks.find((block): block is BlockOf<"contact"> => block.type === "contact")?.primary.label).toBe("Book a call");
  });

  it("their names and repository names were web-checked and recorded in name-check.md", () => {
    for (const slug of STAGE3) {
      const name = EXAMPLES[slug]?.profile.displayName ?? "";
      const latin = { "merle-kastorf": "Merle Kastorf", "rana-al-khatib": "Rana Al-Khatib", "ines-vasconcelos": "Ines Vasconcelos" }[slug];
      expect(NAME_CHECK, slug).toContain(latin);
      if (slug === "rana-al-khatib") expect(NAME_CHECK).toContain(name);
    }
    for (const repo of ["nevoa-epd", "remendo-log", "sardinha-split", "deep-sleep-audit"]) expect(NAME_CHECK, repo).toContain(repo);
  });
});
