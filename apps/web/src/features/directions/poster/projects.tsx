import type { BlockOf, Profile } from "@linkyo/blocks";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import type { ReactNode } from "react";

import { pageSide } from "./styles";

/**
 * A run of consecutive projects: the grid, the numbered list or the row (`chooseProjectsLayout`).
 *
 * Contract only: this version prints the titles as a plain list, so the page compiles and a project
 * is never silently missing. The layouts, the cards and their covers come with the portfolio page;
 * the props stay as they are.
 */
export function ProjectsGroup({
  blocks,
}: {
  blocks: BlockOf<"project">[];
  /** Position of this run among the page's runs of projects (a later run may become a row). */
  groupIndex: number;
  /** The hero already shows the first project (Werkbogen's plate): the grid has no lead tile. */
  leadTaken: boolean;
  theme: ResolvedCreatorTheme;
  locale: Profile["locale"];
  /** The page's quotes: a quote about a project gives it a page of its own. */
  quotes: BlockOf<"quotes">[];
  /** Where project pages live. Absent in previews. */
  base?: string | undefined;
  /** Appended to every project address. */
  suffix?: string | undefined;
  /** Previews without a router: a tap on a card that has a project page. */
  onOpen?: ((id: string) => void) | undefined;
  /** Cards carry their number ("01"). */
  numbered: boolean;
}): ReactNode {
  return (
    <ul className="grid grid-cols-1 gap-2">
      {blocks.map((project) => (
        <li key={project.id} id={project.slug} dir="auto" className={pageSide}>
          {project.title}
        </li>
      ))}
    </ul>
  );
}

/**
 * The cover area of a project card, by `coverMode`: the picture, the first result figure set large,
 * or the title set large. Contract only: it renders nothing yet.
 */
export function ProjectCover(_props: {
  project: BlockOf<"project">;
  /** The `sizes` attribute of the picture (an entry of `mediaSizes`). */
  sizes: string;
  /** The aspect utility of the cover box ("aspect-photo"). */
  ratio: string;
  priority?: boolean | undefined;
  size: "lead" | "tile" | "thumb";
}): ReactNode {
  return null;
}
