import { Icon, PlatformIcon } from "@linkyo/ui";
import { Gift, MapPin, ShieldCheck, type LucideIcon } from "lucide-react";
import { siInstagram, siTiktok, siYoutube } from "simple-icons";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties } from "react";

import { STARS } from "@/features/previews/stars-data";

import { ClaimForm } from "./claim-form";
import { CONCEPT_FACES, CONCEPT_SHOTS, type ConceptShot } from "./examples";
import { HeroDeck, type DeckPage } from "./hero-deck";

export const order = (n: number) => ({ "--i": n }) as CSSProperties;

/**
 * The nine pages that take turns in front, three in view at a time, in an order that keeps
 * neighbours different (dark beside light, one color beside another). All are well-known people:
 * theirs are unofficial concept pages, labelled as such (founder's decision, ADR 0043).
 */
const STACK = Object.keys(CONCEPT_SHOTS) as ConceptShot[];

const LOCALES = ["de", "en", "ar"] as const;

/** The three promises under the address field, each with its own icon. */
const PROMISE_ICONS: LucideIcon[] = [Gift, ShieldCheck, MapPin];

/** Where a Linkyo link lives: the bios people know. Shown small, in the text color. */
const BIO_PLATFORMS = [siInstagram, siTiktok, siYoutube];

/**
 * The first screen, in the order a visitor needs it (ADR 0049):
 *
 * 1. What it is: a line that names the thing ("your page for the link in your bio", with the bios
 *    it lives in), the promise, one sentence.
 * 2. The proof: real pages (HeroDeck).
 * 3. Then the action: claim an address and sign up, with what you get.
 *
 * Phones and tablets read it top to bottom in exactly that order. Wide screens put the pages beside
 * the words and the action, and the hero fills the first screen.
 *
 * The promise is two lines at every width (ADR 0038). Laptops (W-11): beside the pages it is 40 px
 * from 1024 px (the words get 1.15 : 1 of the row, as ADR 0038 has it); from 1280 px the hero (and the
 * header above it) takes the wide column, the words get 1.6 : 1, and the promise grows to 56 px, and to
 * 72 px from 1536 px. Each step is where its second line still fits on one line beside the pages
 * (e2e/home.spec.ts measures it from 1024 to 1920 px). The sentence keeps its reading measure.
 */
export function Hero() {
  const t = useTranslations("marketing");
  const promises = t.raw("hero.pills") as string[];
  const current = useLocale();
  const locale = LOCALES.find((code) => code === current) ?? "de";
  // Concept pages exist in every language: link to, and show, the visitor's own.
  const pages: DeckPage[] = STACK.map((slug) => ({
    slug,
    concept: true,
    face: CONCEPT_FACES[slug],
    name: STARS.find((star) => star.slug === slug)?.name[locale] ?? slug,
    href: `/${locale}/p/${slug}`,
    shot: CONCEPT_SHOTS[slug][locale],
  }));
  return (
    // Clipped at every width: the deck's queued cards wait, invisible, beyond its column, and from
    // 1280 px the wide column brings them past the screen's edge (a sideways scroll up to 1599 px).
    <section aria-labelledby="hero-title" className="overflow-x-clip">
      <div className="mx-auto grid w-full max-w-content grid-cols-1 items-center gap-10 px-5 pt-6 pb-12 md:px-10 md:pt-12 lg:mk-hero-fit lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:grid-rows-2 lg:gap-x-10 lg:gap-y-8 lg:py-8 xl:max-w-content-wide xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:gap-x-16">
        {/* 1. What it is. */}
        <div className="grid min-w-0 grid-cols-1 justify-items-start gap-5 md:gap-6 lg:self-end">
          <p className="mk-rise inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface py-1 ps-1 pe-3 text-small font-semibold text-fg-secondary" style={order(0)}>
            <span aria-hidden className="flex shrink-0 -space-x-2 rtl:space-x-reverse">
              {BIO_PLATFORMS.map((platform) => (
                <span key={platform.slug} className="grid size-6 place-items-center rounded-full border border-line bg-canvas-muted text-fg">
                  <PlatformIcon icon={platform} size="xs" />
                </span>
              ))}
            </span>
            <span className="truncate">{t("hero.eyebrow")}</span>
          </p>
          <h1 id="hero-title" className="max-w-full text-h2 tracking-display text-balance md:text-display lg:text-display-sm xl:text-display 2xl:text-display-xl">
            <span className="mk-rise block" style={order(1)}>
              {t("hero.title1")}
            </span>
            <span className="mk-rise block text-link" style={order(2)}>
              {t("hero.title2")}
            </span>
          </h1>
          <p className="mk-rise max-w-prose text-body text-balance text-fg-secondary md:text-body-lg" style={order(3)}>
            {t("hero.lead")}
          </p>
        </div>

        {/* 2. The proof: real pages. Beside the words on wide screens; between the words and the action on phones. */}
        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <HeroDeck pages={pages} />
        </div>

        {/* 3. The action, once it is clear what Linkyo is. On phones the header's sign-up appears after this. */}
        <div id="hero-cta" className="mk-rise grid w-full min-w-0 max-w-prose gap-5 lg:col-start-1 lg:row-start-2 lg:self-start" style={order(4)}>
          <ClaimForm id="hero-claim" />
          {/* Wide screens only: on phones and tablets the same three points follow right after the
              hero as cards (Trust), and the button already says "free". Saying it twice in a row is noise. */}
          <ul aria-label={t("hero.promises")} className="hidden flex-wrap gap-x-5 gap-y-2 ps-1 lg:flex">
            {promises.map((promise, index) => (
              <li key={promise} className="inline-flex items-center gap-2 text-small font-medium text-fg-secondary">
                <Icon icon={PROMISE_ICONS[index] ?? ShieldCheck} size="sm" className="text-link" />
                {promise}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
