import type { BlockOf, Page, Profile } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import { PAIRING_IDS, type ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { cn } from "@linkyo/ui";
import type { ReactNode } from "react";

import { PosterBar } from "./hero";
import { SignpostIndex, SignpostSection, signposts as signpostsOf } from "./laufbahn";
import { BleedHero, type Lead } from "./laufbahn-hero";
import type { PosterSection as Section } from "./sections";

/** The start of a signposted page's content: "read on" leads here when the first section has no title. */
const CONTENT_ID = "page-content";

/**
 * The theme with its pairing as the tokens' own object. This body is a client module, so the theme it
 * gets from the server is a copy; the name is fitted by finding the theme's pairing among the tokens by
 * identity (`PAIRING_IDS.find(… === theme.pairing)`, ./hero.tsx), which a copy never matches: an Arabic
 * name was fitted as a Latin one and came out smaller.
 */
function withTokenPairing(theme: ResolvedCreatorTheme): ResolvedCreatorTheme {
  const copy = JSON.stringify(theme.pairing);
  const id = PAIRING_IDS.find((key) => creatorTokens.pairings[key] === theme.pairing || JSON.stringify(creatorTokens.pairings[key]) === copy);
  return id ? { ...theme, pairing: creatorTokens.pairings[id] } : theme;
}

/** The hero's own props, the same for every treatment. */
export interface SignpostedHeroProps {
  profile: Page["profile"];
  socials: BlockOf<"socials"> | undefined;
  live: BlockOf<"live"> | undefined;
  theme: ResolvedCreatorTheme;
  preview: boolean;
  contact: BlockOf<"contact"> | undefined;
  primary: BlockOf<"contact">["primary"] | null | undefined;
  now: Date;
}

/**
 * The body of a signposted page (Laufbahn, `layout.headings` "signpost"): the app bar with the page's
 * contents, the hero (the bleed hero's first action leads to the cover letter, the first section or the
 * content), and the sections beside their index. The renderer draws the sections' items and loads this
 * body through `./signposted-lazy.tsx`, so Laufbahn's client code ships with Laufbahn's pages alone and
 * never with the pages of other templates (ADR 0008). The markup is the renderer's, moved here whole.
 */
export default function SignpostedBody({
  profile,
  primary,
  contact,
  sections,
  items,
  marks,
  letter,
  heroProps,
  hero,
  banner,
  preview,
}: {
  profile: Profile;
  primary: BlockOf<"contact">["primary"] | null | undefined;
  contact: BlockOf<"contact"> | undefined;
  sections: Section[];
  /** Each section's items as the renderer drew them, by section id. */
  items: Record<string, ReactNode[]>;
  /** Each section's marks: the dashboard preview's block ids and the AI label, by section id. */
  marks: Record<string, { blockIds: string | undefined; ai: boolean }>;
  /** The page's cover letter: its section and its text block (the renderer finds it). */
  letter: { section: string; block: string } | undefined;
  heroProps: SignpostedHeroProps;
  /** Any other hero than the bleed hero, drawn by the renderer. */
  hero: ReactNode;
  /** An overlay (a preview label) stands over the top of the page. */
  banner: boolean;
  preview: boolean;
}) {
  const Main = preview ? "div" : "main";
  const theme = withTokenPairing(heroProps.theme);
  const signposts = signpostsOf(sections);
  const firstSign = signposts[0];
  // Without a contact block the bleed hero's first action leads to the cover letter when the page has
  // one, else to the first section when that is titled, else to the start of the content (an untitled
  // run, a live card or a release first, is never skipped).
  const letterSign = letter ? signposts.find((sign) => sign.id === letter.section) : undefined;
  const heroLead: Lead | undefined = letterSign
    ? { href: `#${letterSign.anchor}`, kind: "letter" }
    : !firstSign
      ? undefined
      : sections[0]?.id === firstSign.id
        ? { href: `#${firstSign.anchor}`, kind: "section", title: firstSign.title }
        : { href: `#${CONTENT_ID}`, kind: "content" };
  return (
    <>
      <PosterBar
        profile={profile}
        primary={primary}
        primaryBlock={contact?.id}
        solid
        sections={signposts.length > 1 ? signposts.map(({ anchor, title }) => ({ anchor, title })) : undefined}
      />
      {theme.layout.hero === "bleed" ? <BleedHero {...heroProps} theme={theme} lead={heroLead} banner={banner} /> : hero}
      {/* Marks the end of the hero: the Linkyo bar slides in once this has scrolled up. */}
      <div data-poster-sentinel aria-hidden />
      {/* Phones: the sections under the hero (their contents open from the app bar). Tablets: the index's
          chips, then the sections, in the reading column. The wide canvas: the index sticky in the first
          three columns, the sections in the last eight. */}
      <Main
        id={CONTENT_ID}
        className="grid grid-cols-1 gap-10 px-creator-gutter pt-10 @prose:mx-auto @prose:max-w-prose @prose:px-0 @work:max-w-none @work:grid-cols-12 @work:gap-x-6 @work:pt-24"
      >
        {signposts.length > 1 ? <SignpostIndex entries={signposts} /> : null}
        {/* Beside the index in the last eight columns; without an index in the first eight, under the hero's words. */}
        <div className={cn("relative grid min-w-0 grid-cols-1 gap-12 @work:col-span-8 @work:gap-16", signposts.length > 1 ? "@work:col-start-5" : "@work:col-start-1")}>
          {sections.map((section) => {
            // Nothing rises in as it scrolls: the page scrolls, the content stays still (as in an app).
            return (
              <SignpostSection key={section.id} entry={signposts.find((sign) => sign.id === section.id)} blockIds={marks[section.id]?.blockIds} ai={marks[section.id]?.ai ?? false}>
                {items[section.id]}
              </SignpostSection>
            );
          })}
          {/* The end of the content: once it is on screen, the index marks the last section. Out of the
              grid's flow (absolute), so it adds no gap under the last section. */}
          <div data-lb-end aria-hidden className="absolute inset-x-0 bottom-0 h-px" />
        </div>
      </Main>
    </>
  );
}
