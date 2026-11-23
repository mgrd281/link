import type { BlockOf, Profile } from "@linkyo/blocks";
import type { ReactNode } from "react";

import { pageSide } from "./styles";

/**
 * The portfolio's sections beside the work: about, skills and tools, experience, quotes, clients as
 * names, and the contact band that closes the page.
 *
 * Contracts only: the five new sections render nothing yet (no page has such a block before the
 * editor can make one), so the page compiles and every later change has its place. The props stay
 * as they are.
 */

/** Who the owner is: a lead paragraph, a portrait and up to four facts. */
export function AboutSection(_props: { block: BlockOf<"about">; wide: boolean }): ReactNode {
  return null;
}

/** Skills and tools as plain chips: no levels, no logos, no links. */
export function ToolsSection(_props: { block: BlockOf<"tools"> }): ReactNode {
  return null;
}

/** Experience: roles and years in the order the owner entered them. */
export function TimelineSection(_props: { block: BlockOf<"timeline">; locale: Profile["locale"] }): ReactNode {
  return null;
}

/**
 * Quotes the owner chose and may publish. `projects` are the page's projects: a quote about one of
 * them links to it. Always ends with the line that says who chose them.
 */
export function QuotesSection(_props: { block: BlockOf<"quotes">; ownerName: string; projects: BlockOf<"project">[]; base?: string | undefined; wide: boolean }): ReactNode {
  return null;
}

/** The closing band: the owner's line, the status, the page's one primary action and other ways. No form. */
export function ContactBand(_props: { block: BlockOf<"contact">; now: Date; wide: boolean }): ReactNode {
  return null;
}

/**
 * Clients without any logo: a list of names.
 *
 * Contract only, but never empty: a partner block made today without logos (the editor allows it,
 * and a public page drops logos from other hosts) is sent here, so this version prints the names
 * as a plain list and keeps the address of a name that had one. The designed list comes with the
 * sections; the props stay as they are.
 */
export function BrandNames({ block }: { block: BlockOf<"brands"> }): ReactNode {
  return (
    <ul className="grid grid-cols-1 gap-2">
      {block.items.map((item) => (
        <li key={item.name} dir="auto" className={pageSide}>
          {item.url ? (
            <a href={item.url} className="inline-flex min-h-touch-target items-center rounded-xs font-semibold text-creator-accent-text transition-colors duration-micro hover:text-creator-fg focus-visible:focus-ring">
              {item.name}
            </a>
          ) : (
            item.name
          )}
        </li>
      ))}
    </ul>
  );
}
