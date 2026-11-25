import { cn, Icon } from "@linkyo/ui";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { MarketingFooter } from "../footer";
import { MarketingHeader } from "../header";
import { PAGE_TITLE, SECTION_TITLE } from "../headings";
import type { MenuItem } from "../mobile-menu";

/**
 * A page of the website (help, contact, features, about, changelog, security): the site's header and
 * footer around an opening (a small label with the page's glyph, its title and one sentence) and the
 * page's sections. Server-rendered; a page brings its own islands (the help search) where it needs one.
 * The title settles in without fading, so it paints at once.
 */
export function SitePage({
  current,
  icon,
  eyebrow,
  title,
  lead,
  opening,
  children,
}: {
  /** The place in the header this page is, if it is one. */
  current?: MenuItem["key"] | undefined;
  icon: LucideIcon;
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  /** More of the opening under the sentence (the help search). */
  opening?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <MarketingHeader current={current} />
      <main id="main" className="grid grid-cols-1 pb-12 md:pb-24">
        <section aria-labelledby="page-title" className="mx-auto grid w-full max-w-content justify-items-start gap-5 px-5 pt-8 pb-10 md:gap-6 md:px-10 md:pt-16 md:pb-16">
          <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface py-1 ps-1 pe-3 text-small font-semibold text-fg-secondary">
            <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-selected text-selected-fg">
              <Icon icon={icon} size="sm" />
            </span>
            {eyebrow}
          </p>
          <h1 id="page-title" className={cn(PAGE_TITLE, "mk-settle max-w-full hyphens-auto")}>
            {title}
          </h1>
          <p className="max-w-prose text-body-lg text-pretty text-fg-secondary">{lead}</p>
          {opening}
        </section>
        {children}
      </main>
      <MarketingFooter />
    </>
  );
}

/** A section of a site page: its title (h2) and content, in the page's column. */
export function SiteSection({ id, title, lead, className, children }: { id: string; title: ReactNode; lead?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("mx-auto grid w-full max-w-content scroll-mt-24 gap-6 px-5 py-10 md:gap-8 md:px-10 md:py-12", className)}>
      <header className="grid max-w-prose gap-3">
        <h2 id={`${id}-title`} className={SECTION_TITLE}>
          {title}
        </h2>
        {lead ? <p className="text-body-lg text-pretty text-fg-secondary">{lead}</p> : null}
      </header>
      {children}
    </section>
  );
}

/**
 * A link that stands alone (not inside a sentence): Linkyo Teal and bold with a glyph (one before the
 * words, or a chevron after them), at least a touch target tall. Plain anchors take it too, for
 * addresses outside the router (mailto, the legal pages).
 */
export const standaloneLink =
  "-mx-2 inline-flex min-h-touch-target items-center gap-2 rounded-md px-2 text-body font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring active:bg-pressed";
