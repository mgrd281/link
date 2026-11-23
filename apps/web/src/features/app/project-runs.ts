import { chooseProjectsLayout, isBlockActive, type Block, type BlockOf } from "@linkyo/blocks";

import { featuredApp, groupSections, type PosterItem } from "@/features/directions/poster/sections";

type ProjectsLayout = ReturnType<typeof chooseProjectsLayout>;

/**
 * The runs of projects as the page shows them and as the editor's list shows them.
 *
 * The page's runs are the renderer's own: made from the blocks it shows (a hidden or scheduled block
 * neither changes a layout nor splits a run) and grouped as it groups them, each with the layout it
 * gets (`layouts`, in page order). The list shows every project, hidden ones too: a run there is
 * projects one after the other, named once (`starts`: its length, and the layout of the page's run
 * that holds its first shown project, null when the page shows none of them), and each shown project
 * has its place in its page's run (`position`; 0 for a project the page does not show).
 */
export function projectRuns(blocks: readonly Block[], wanted: Parameters<typeof chooseProjectsLayout>[2], now: Date = new Date()) {
  const shown = blocks.filter((block) => isBlockActive(block, now));
  const pageRuns = groupSections(shown, featuredApp(shown))
    .flatMap((section) => section.items)
    .filter((item): item is Extract<PosterItem, { kind: "projects" }> => item.kind === "projects")
    .map((item, index) => ({ ids: item.blocks.map((block) => block.id), layout: chooseProjectsLayout(item.blocks, index, wanted) }));
  const onPage = new Map<string, { layout: ProjectsLayout; place: number }>();
  for (const pageRun of pageRuns) pageRun.ids.forEach((id, index) => onPage.set(id, { layout: pageRun.layout, place: index + 1 }));

  const starts = new Map<string, { count: number; layout: ProjectsLayout | null }>();
  const position = new Map<string, number>();
  let run: BlockOf<"project">[] = [];
  const flush = () => {
    const first = run[0];
    if (first) {
      const firstShown = run.find((project) => onPage.has(project.id));
      starts.set(first.id, { count: run.length, layout: firstShown ? (onPage.get(firstShown.id)?.layout ?? null) : null });
    }
    run = [];
  };
  for (const block of blocks) {
    if (block.type !== "project") {
      flush();
      continue;
    }
    run.push(block);
    position.set(block.id, onPage.get(block.id)?.place ?? 0);
  }
  flush();
  return { starts, position, layouts: pageRuns.map((pageRun) => pageRun.layout) };
}
