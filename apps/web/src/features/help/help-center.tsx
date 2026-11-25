"use client";

import { Button, Icon, IconButton, icons, TextField, TooltipProvider } from "@linkyo/ui";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";

import { Link } from "@/i18n/navigation";

import type { HelpGroup } from "./articles";
import { matchArticles, type SearchableArticle } from "./search";

/** One article as the page hands it over: rendered words, plain words for the search, a link onwards. */
export interface HelpCenterArticle extends SearchableArticle {
  group: HelpGroup;
  view: { title: ReactNode; summary: ReactNode; body: ReactNode[] };
  related?: { href: string; label: string } | undefined;
}

const linkClass =
  "-mx-2 inline-flex min-h-touch-target items-center gap-2 self-start rounded-md px-2 text-body font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring active:bg-pressed";

/** The article an address points at (`/de/hilfe#statistik`), if it is one of these. */
function targetOf(hash: string, slugs: readonly string[]): string | null {
  const slug = decodeURIComponent(hash.replace(/^#/, ""));
  return slugs.includes(slug) ? slug : null;
}

/**
 * The help page's island: a search field over the articles and the list itself. Everything it shows
 * comes from the page (rendered on the server, in the visitor's language); the island reads only
 * `help.search.*` for its own words. A search keeps the articles that hold every word typed (title,
 * short answer or body; folded, so "loeschen" finds "löschen" and an Arabic word with or without its
 * vowel marks), opens them, and says how many there are; nothing typed leaves the page. An address
 * with an article's slug opens that article.
 */
export function HelpCenter({
  articles,
  groups,
  contactHref,
}: {
  articles: HelpCenterArticle[];
  groups: { key: HelpGroup; label: string }[];
  contactHref: string;
}) {
  const t = useTranslations("help.search");
  const id = useId();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const slugs = useMemo(() => articles.map((article) => article.slug), [articles]);
  const matches = useMemo(() => matchArticles(articles, query), [articles, query]);
  const searching = query.trim() !== "";

  // Opened at an article: open it, bring it into view, and do the same when the address changes.
  useEffect(() => {
    const follow = () => {
      const slug = targetOf(window.location.hash, slugs);
      setTarget(slug);
      if (slug)
        requestAnimationFrame(() => document.getElementById(slug)?.scrollIntoView({ block: "start" }));
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => {
      window.removeEventListener("hashchange", follow);
    };
  }, [slugs]);

  const shown = new Set(matches.map((article) => article.slug));
  const order = searching ? matches : articles;
  // The clear button's tooltip needs a provider: since ADR 0008's Stage 4 revision the site's root
  // layout carries none (tooltips come with the areas that show them).
  return (
    <TooltipProvider>
      <div className="max-w-content mx-auto grid w-full gap-8 px-5 md:gap-10 md:px-10">
        <div role="search" className="grid max-w-prose gap-3">
          <TextField
            id={`${id}-query`}
            type="search"
            label={t("label")}
            hideLabel
            icon={icons.search}
            size="lg"
            placeholder={t("placeholder")}
            value={query}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            trailing={
              searching ? (
                <IconButton
                  icon={icons.close}
                  label={t("clear")}
                  variant="ghost"
                  onClick={() => {
                    setQuery("");
                    document.getElementById(`${id}-query`)?.focus();
                  }}
                />
              ) : null
            }
          />
          <p role="status" aria-live="polite" className="text-small text-fg-secondary">
            {searching ? t("results", { count: matches.length }) : null}
          </p>
        </div>

        {searching && matches.length === 0 ? (
          <div
            data-help-empty
            className="bg-canvas-muted grid max-w-prose justify-items-start gap-3 rounded-xl p-6 md:p-8"
          >
            <span
              aria-hidden
              className="size-control-md bg-tinted text-tinted-fg grid place-items-center rounded-full"
            >
              <Icon icon={icons.search} size="md" />
            </span>
            <p className="text-title text-balance">{t("empty", { query: query.trim() })}</p>
            <p className="text-body text-fg-secondary">{t("emptyHint")}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button
                variant="tinted"
                onClick={() => {
                  setQuery("");
                  document.getElementById(`${id}-query`)?.focus();
                }}
              >
                {t("clear")}
              </Button>
              <Link href={contactHref} className={linkClass}>
                <Icon icon={icons.email} size="md" />
                {t("contact")}
              </Link>
            </div>
          </div>
        ) : null}

        {groups.map((group) => {
          const inGroup = order.filter((article) => article.group === group.key && shown.has(article.slug));
          if (inGroup.length === 0) return null;
          return (
            <section
              key={group.key}
              aria-labelledby={`${id}-${group.key}`}
              className="max-w-column-wide grid gap-4"
            >
              <h2 id={`${id}-${group.key}`} className="text-h3 text-balance">
                {group.label}
              </h2>
              <ul className="grid gap-3">
                {inGroup.map((article) => (
                  <li key={article.slug}>
                    <details
                      id={article.slug}
                      data-help-article={article.slug}
                      open={searching || target === article.slug ? true : undefined}
                      className="group border-line bg-surface scroll-mt-24 rounded-xl border"
                    >
                      {/* A summary holds headings and phrasing only: the title and its short answer are its
                        own children, set in a grid with the glyph beside both. */}
                      <summary className="duration-micro hover:bg-hover focus-visible:focus-ring active:bg-pressed grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 rounded-xl p-5 transition-colors outline-none md:p-6 [&::-webkit-details-marker]:hidden">
                        <h3 className="text-title text-balance">{article.view.title}</h3>
                        <span
                          aria-hidden
                          className="bg-canvas-muted text-fg-secondary duration-standard ease-standard group-open:bg-primary group-open:text-primary-fg col-start-2 row-span-2 row-start-1 mt-0.5 grid size-8 place-items-center rounded-full transition-[rotate,background-color,color] group-open:rotate-45 motion-reduce:transition-none"
                        >
                          <Icon icon={icons.add} size="sm" />
                        </span>
                        <span className="text-body text-fg-secondary text-pretty">
                          {article.view.summary}
                        </span>
                      </summary>
                      <div className="grid gap-3 px-5 pb-6 md:px-6">
                        {article.view.body.map((paragraph, index) => (
                          // Keyed by the paragraph's plain words (the search's copy of it): unique in an article.
                          <p
                            key={article.body[index] ?? article.slug}
                            className="text-body text-fg-secondary max-w-prose text-pretty"
                          >
                            {paragraph}
                          </p>
                        ))}
                        {article.related ? (
                          <Link href={article.related.href} className={linkClass}>
                            {article.related.label}
                            <Icon icon={icons.next} size="sm" />
                          </Link>
                        ) : null}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
