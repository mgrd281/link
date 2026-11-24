import { blockSchema, pageSchema, type Block } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import {
  isPortfolioKind,
  KINDS,
  lookOrder,
  PORTFOLIO_KINDS,
  PORTFOLIO_STEPS,
  proofProblem,
  socialUrl,
  STARTERS,
  starterBlocks,
  starterFields,
  titleKeys,
  WELCOME_STEPS,
  welcomeSteps,
  type CreatorKind,
  type ProofRow,
  type StarterInput,
} from "./kinds";

const labels = {
  directions: (address: string) => `Directions: ${address}`,
  call: "Call",
  hours: "Opening hours",
  shop: "Visit the store",
  website: "Website",
  booking: "Book an appointment",
  contact: "Contact",
  book: "My book",
  cv: "My CV",
  newsletter: "Subscribe",
  liveTitle: "Live on TikTok",
  detection: { video: "Video", music: "Music", event: "Event" },
  artist: "Mila",
  work: "Work",
  closing: "Got a project in mind? I look forward to your message.",
};

/** Three pieces of work as a designer types them; the second has a cover. */
const WORK: ProofRow[] = [
  { title: "Harbour Light", summary: "A night series for the port authority." },
  { title: "Kiosk Atlas", summary: "Signage for forty kiosks.", cover: { src: "data:image/jpeg;base64,AAAA", alt: "A kiosk at dusk", tone: "dark", w: 1080, h: 720 } },
  { title: "Rooftop Garden", summary: "A brand for a rooftop café." },
];
const REACH = { label: "Start a project", url: "mailto:hello@example.com", icon: "mail" } as const;

/** The page a starter makes, checked by the page rules (one contact, distinct project addresses). */
const parsesAsPage = (blocks: Block[]) =>
  pageSchema.safeParse({ profile: { username: "mila-berg", displayName: "Mila Berg", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "en" }, blocks }).success;

const build = (input: Partial<StarterInput> & Pick<StarterInput, "kind">): Block[] =>
  starterBlocks({ handles: {}, values: {}, switches: {}, links: "", ...input }, labels);

/** The default section titles by kind: the kind, then the variant of its work, tools and quotes title. */
const TITLES: [CreatorKind, string, string, string][] = [
  ["designer", "designer", "designer", "default"],
  ["photographer", "designer", "designer", "default"],
  ["developer", "developer", "developer", "developer"],
  ["engineer", "developer", "developer", "developer"],
  ["student", "developer", "default", "default"],
  ["writer", "writer", "writer", "default"],
  ["journalist", "writer", "writer", "default"],
  ["coach", "coach", "default", "default"],
  ["lawyer", "lawyer", "lawyer", "default"],
  ["freelancer", "default", "default", "default"],
  ["tiktok", "default", "default", "default"],
  ["instagram", "default", "default", "default"],
  ["youtube", "default", "default", "default"],
  ["apps", "default", "default", "default"],
  ["streamer", "default", "default", "default"],
  ["podcast", "default", "default", "default"],
  ["music", "default", "default", "default"],
  ["affiliate", "default", "default", "default"],
  ["store", "default", "default", "default"],
  ["marketing", "default", "default", "default"],
  ["shop", "default", "default", "default"],
  ["business", "default", "default", "default"],
  ["warehouse", "default", "default", "default"],
  ["other", "default", "default", "default"],
];

describe("page kinds in the welcome flow", () => {
  it("gives every kind a template and its own first questions", () => {
    const templates = new Set(KINDS.map((kind) => STARTERS[kind].theme.template));
    expect(templates.size).toBeGreaterThanOrEqual(5);
    expect(STARTERS.shop.fields).toEqual(["address", "phone", "hours"]);
    expect(STARTERS.tiktok.socials[0]).toBe("tiktok");
    expect(STARTERS.youtube.socials[0]).toBe("youtube");
    expect(STARTERS.journalist.socials).toContain("linkedin");
    expect(STARTERS.lawyer.fields).toEqual(["booking", "phone", "email", "address"]);
    expect(STARTERS.student.fields).toContain("cv");
  });

  it("starters (lead decision G2): designers, photographers and freelancers on Werkbogen, developers and engineers on Tiefdruck", () => {
    expect(KINDS).toHaveLength(24);
    expect(KINDS.indexOf("photographer")).toBe(KINDS.indexOf("designer") + 1);
    expect(KINDS.indexOf("freelancer")).toBe(KINDS.indexOf("student") - 1);
    // The whole mapping for the portfolio kinds: template, first profiles, questions.
    expect(STARTERS.designer).toEqual({ theme: { template: "werkbogen" }, socials: ["instagram", "linkedin", "threads"], fields: ["proof", "action"], logoFirst: false });
    expect(STARTERS.photographer).toEqual({ theme: { template: "werkbogen" }, socials: ["instagram", "linkedin", "youtube"], fields: ["proof", "action"], logoFirst: false });
    expect(STARTERS.freelancer).toEqual({ theme: { template: "werkbogen" }, socials: ["linkedin", "instagram", "whatsapp"], fields: ["proof", "action"], logoFirst: false });
    expect(STARTERS.developer).toEqual({ theme: { template: "tiefdruck" }, socials: ["github", "linkedin", "x"], fields: ["proof", "action", "cv"], logoFirst: false });
    expect(STARTERS.engineer).toEqual({ theme: { template: "tiefdruck" }, socials: ["linkedin", "x", "instagram"], fields: ["proof", "action", "cv"], logoFirst: false });
    expect(PORTFOLIO_KINDS).toEqual(["designer", "photographer", "developer", "engineer", "freelancer"]);
    expect(KINDS.filter((kind) => isPortfolioKind(kind))).toHaveLength(5);
    expect(isPortfolioKind(undefined)).toBe(false);
    // Exactly the portfolio kinds are asked for their work and a way to reach them, in steps of their own.
    for (const kind of KINDS) {
      const asked = STARTERS[kind].fields.includes("proof") && STARTERS[kind].fields.includes("action");
      expect(asked, kind).toBe(isPortfolioKind(kind));
      expect(welcomeSteps(kind), kind).toEqual(isPortfolioKind(kind) ? PORTFOLIO_STEPS : WELCOME_STEPS);
    }
    expect(welcomeSteps(null)).toEqual(WELCOME_STEPS);
    expect(PORTFOLIO_STEPS).toEqual(["kind", "you", "look", "proof", "action", "done"]);
    // The other kinds keep their looks.
    expect(STARTERS.writer.theme).toEqual({ template: "atelier" });
    expect(STARTERS.coach.theme).toEqual({ template: "daylight", pairing: "elegant" });
  });

  it("the look step leads with the kind's starter, then the looks the tokens suggest for it", () => {
    expect(lookOrder("photographer").slice(0, 2)).toEqual(["werkbogen", "folio"]);
    expect(lookOrder("designer")[0]).toBe("werkbogen");
    expect(lookOrder("designer")).toEqual(expect.arrayContaining(["tiefdruck", "atelier", "folio"]));
    expect(lookOrder("developer").slice(0, 2)).toEqual(["tiefdruck", "signal"]);
    for (const kind of KINDS) {
      const order = lookOrder(kind);
      expect(order[0], kind).toBe(STARTERS[kind].theme.template);
      expect(new Set(order).size, kind).toBe(order.length);
    }
  });

  it("a portfolio kind's page: its work title over three projects, the contact block last, all valid", () => {
    const blocks = build({ kind: "designer", handles: { instagram: "mila.berg" }, proof: WORK, reach: REACH, links: "https://example.com/press" });
    // A pasted link stays what it is (a card) and sits after the work; the contact block closes the page.
    expect(blocks.map((block) => block.type)).toEqual(["socials", "header", "project", "project", "project", "card", "contact"]);
    for (const block of blocks) expect(blockSchema.safeParse(block).success, block.type).toBe(true);
    expect(parsesAsPage(blocks)).toBe(true);
    const [, header, first, second] = blocks;
    expect(header?.type === "header" && header.title).toBe("Work");
    expect(first?.type === "project" && [first.slug, first.title, first.summary, first.cover]).toEqual(["harbour-light", "Harbour Light", "A night series for the port authority.", undefined]);
    // A row with a picture makes a project with a cover (its card shows the picture).
    expect(second?.type === "project" && second.cover).toEqual(WORK[1]?.cover);
    const contact = blocks.at(-1);
    expect(contact?.type === "contact" && [contact.title, contact.primary]).toEqual([labels.closing, { label: "Start a project", url: "mailto:hello@example.com", icon: "mail" }]);
  });

  it("pieces of work: empty ones are skipped, started ones need a title and a sentence", () => {
    expect(proofProblem({ title: "", summary: "" })).toBeNull();
    expect(proofProblem({ title: "Harbour Light", summary: " " })).toBe("summary");
    expect(proofProblem({ title: "", summary: "A night series." })).toBe("title");
    expect(proofProblem({ title: "", summary: "", cover: { src: "data:image/jpeg;base64,AAAA", alt: "" } })).toBe("title");
    expect(proofProblem({ title: "Harbour Light", summary: "A night series." })).toBeNull();
    // Nothing filled in: no title, no projects, no contact (every question is optional).
    expect(build({ kind: "photographer", proof: [{ title: "", summary: "" }], reach: { label: "", url: "" } })).toEqual([]);
    // A started row without its sentence never becomes a half project.
    expect(build({ kind: "photographer", proof: [{ title: "Only a title", summary: "" }, ...WORK.slice(0, 1)] }).filter((block) => block.type === "project")).toHaveLength(1);
  });

  it("project addresses: made from the title, never one the page already uses, a word and a number for Arabic titles", () => {
    const arabic: ProofRow[] = [
      { title: "ضوء الميناء", summary: "سلسلة ليلية للميناء." },
      { title: "أطلس الأكشاك", summary: "لافتات لأربعين كشكًا." },
      { title: "Harbour Light", summary: "Again, in English." },
    ];
    const blocks = build({ kind: "photographer", proof: arabic, taken: ["harbour-light", "project-1"], slugWord: "project" });
    expect(blocks.flatMap((block) => (block.type === "project" ? [block.slug] : []))).toEqual(["project-2", "project-3", "harbour-light-2"]);
    expect(parsesAsPage(blocks)).toBe(true);
    expect(build({ kind: "photographer", proof: arabic.slice(0, 1), slugWord: "projekt" }).find((block) => block.type === "project")).toMatchObject({ slug: "projekt-1" });
  });

  it("developers: the CV joins the contact block; without one it stays its own button; repositories stay repo blocks", () => {
    const withContact = build({ kind: "developer", handles: { github: "leonpark" }, values: { cv: "example.com/cv.pdf" }, proof: WORK.slice(0, 1), reach: { label: "Book an intro call", url: "https://cal.example.com/leon", icon: "calendar" }, links: "https://github.com/acme/agent-skills" });
    expect(withContact.map((block) => block.type)).toEqual(["socials", "header", "project", "repo", "contact"]);
    const contact = withContact.at(-1);
    expect(contact?.type === "contact" && contact.links).toEqual([{ kind: "cv", url: "https://example.com/cv.pdf" }]);
    for (const block of withContact) expect(blockSchema.safeParse(block).success, block.type).toBe(true);
    const without = build({ kind: "engineer", values: { cv: "example.com/cv.pdf" } });
    expect(without.map((block) => [block.type, block.type === "link" && block.icon])).toEqual([["link", "file"]]);
  });

  it("real accounts are not asked for a newsletter and get none; the demo still offers it", () => {
    expect(starterFields("coach", { newsletter: true })).toEqual(["booking", "newsletter", "email"]);
    expect(starterFields("coach", { newsletter: false })).toEqual(["booking", "email"]);
    for (const kind of KINDS) expect(starterFields(kind, { newsletter: false }), kind).not.toContain("newsletter");
    expect(build({ kind: "writer", switches: { newsletter: true }, newsletter: false })).toEqual([]);
    expect(build({ kind: "writer", switches: { newsletter: true } }).map((block) => block.type)).toEqual(["newsletter"]);
  });

  it.each(TITLES)("section titles of %s: work.%s, tools.%s, quotes.%s", (kind, work, tools, quotes) => {
    expect(titleKeys(kind)).toEqual({
      work: `titles.work.${work}`,
      tools: `titles.tools.${tools}`,
      quotes: `titles.quotes.${quotes}`,
      timeline: "titles.timeline.default",
      about: "titles.about.default",
      clients: "titles.clients.default",
    });
  });

  it("section titles: the table above names every kind, every key is a message in all three languages", async () => {
    expect(titleKeys(undefined).work).toBe("titles.work.default");
    expect(TITLES.map(([kind]) => kind).sort()).toEqual([...KINDS].sort());
    for (const locale of ["de", "en", "ar"]) {
      const messages = ((await import(`../../messages/${locale}.json`)) as { default: { app: { portfolio: { titles: Record<string, Record<string, string>> } } } }).default.app.portfolio.titles;
      for (const kind of KINDS) {
        for (const key of Object.values<string>({ ...titleKeys(kind) })) {
          const [, section = "", variant = ""] = key.split(".");
          expect(messages[section]?.[variant], `${locale} ${key}`).toEqual(expect.any(String));
        }
      }
    }
  });

  it("a shop gets directions, a call button and opening hours — all valid blocks", () => {
    const blocks = build({
      kind: "shop",
      handles: { instagram: "@cafe.rosa", whatsapp: "+49 170 1234567" },
      values: { address: "Hauptstraße 5, Berlin", phone: "+49 30 123 456", hours: "Mo–Fr 8–18" },
    });
    expect(blocks.map((block) => block.type)).toEqual(["socials", "link", "link", "header", "text"]);
    for (const block of blocks) expect(blockSchema.safeParse(block).success, block.type).toBe(true);
    const [socials, directions, call] = blocks;
    expect(socials?.type === "socials" && socials.items.map((item) => item.url)).toEqual(["https://instagram.com/cafe.rosa", "https://wa.me/491701234567"]);
    expect(directions?.type === "link" && [directions.title, directions.url, directions.highlight]).toEqual([
      "Directions: Hauptstraße 5, Berlin",
      "https://www.google.com/maps/search/?api=1&query=Hauptstra%C3%9Fe%205%2C%20Berlin",
      true,
    ]);
    expect(call?.type === "link" && call.url).toBe("tel:+4930123456");
  });

  it("affiliate links are labelled as ads when the creator says so, and only then", () => {
    const links = "https://shop.example.com/products/headphones\nhttps://partner.example.com/deal";
    const labelled = build({ kind: "affiliate", links, switches: { affiliate: true } });
    const ads = labelled.filter((block) => block.type === "product" || block.type === "card" || block.type === "link");
    expect(ads.length).toBe(2);
    for (const block of ads) {
      expect("affiliate" in block && block.affiliate, block.type).toBe(true);
      expect(blockSchema.safeParse(block).success, block.type).toBe(true);
    }
    expect(build({ kind: "affiliate", links }).some((block) => "affiliate" in block && block.affiliate === true)).toBe(false);
    // Other kinds have no affiliate switch, so it cannot label their links by accident.
    expect(build({ kind: "store", links, switches: { affiliate: true } }).some((block) => "affiliate" in block && block.affiliate === true)).toBe(false);
  });

  it("developers start with GitHub, streamers with Twitch and Discord", () => {
    expect(STARTERS.developer.socials[0]).toBe("github");
    expect(socialUrl("github", "@leonpark")).toBe("https://github.com/leonpark");
    expect(STARTERS.streamer.socials.slice(0, 2)).toEqual(["twitch", "discord"]);
    expect(socialUrl("twitch", "novaplays")).toBe("https://twitch.tv/novaplays");
    const blocks = build({ kind: "developer", handles: { github: "leonpark" }, values: { cv: "example.com/cv.pdf" } });
    for (const block of blocks) expect(blockSchema.safeParse(block).success, block.type).toBe(true);
  });

  it("a TikToker who goes live gets a live card for their channel", () => {
    const blocks = build({ kind: "tiktok", handles: { tiktok: "https://www.tiktok.com/@nizarals9?_r=1" }, switches: { tiktokLive: true } });
    const live = blocks.find((block) => block.type === "live");
    expect(live?.type === "live" && [live.platform, live.channel, live.url, live.isLive]).toEqual(["tiktok", "nizarals9", "https://www.tiktok.com/@nizarals9/live", false]);
    expect(build({ kind: "tiktok", switches: { tiktokLive: true } }).some((block) => block.type === "live")).toBe(false);
  });

  it("skips what was left empty or is not usable", () => {
    expect(build({ kind: "business", values: { email: "not-an-email", website: " " } })).toEqual([]);
    expect(build({ kind: "writer", switches: { newsletter: true } }).map((block) => block.type)).toEqual(["newsletter"]);
    expect(socialUrl("whatsapp", "12")).toBeNull();
  });

  it("app explainers start in Aura; store links become app cards and GitHub links skills, all valid", () => {
    expect(STARTERS.apps.theme.template).toBe("aura");
    expect(STARTERS.apps.socials[0]).toBe("tiktok");
    const blocks = build({
      kind: "apps",
      links: "https://apps.apple.com/de/app/fokus-timer/id1234567890\nhttps://play.google.com/store/apps/details?id=com.example.schlafwelle\nhttps://github.com/acme/agent-skills/tree/main/skills/brand-voice",
    });
    expect(blocks.map((block) => block.type)).toEqual(["app", "app", "repo"]);
    for (const block of blocks) expect(blockSchema.safeParse(block).success, block.type).toBe(true);
    const [apple, google, skill] = blocks;
    expect(apple?.type === "app" && [apple.title, apple.stores]).toEqual(["Fokus Timer", [{ store: "appstore", url: "https://apps.apple.com/de/app/fokus-timer/id1234567890" }]]);
    expect(google?.type === "app" && [google.title, google.stores[0]?.store]).toEqual(["Schlafwelle", "googleplay"]);
    expect(skill?.type === "repo" && [skill.owner, skill.repo, skill.path, skill.kind, skill.install]).toEqual([
      "acme",
      "agent-skills",
      "skills/brand-voice",
      "skill",
      "npx skills add acme/agent-skills --skill brand-voice",
    ]);
  });

  it("pasted links still become the right blocks", () => {
    const blocks = build({ kind: "youtube", links: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" });
    expect(blocks.map((block) => block.type)).toEqual(["video"]);
  });
});
