"use client";

import { coverImage, formatYears, hasImage, nextStep, type Block, type BlockOf, type CreatorKind, type ProjectStep } from "@linkyo/blocks";
import { PROJECTS_STYLES, type ProjectsStyle } from "@linkyo/tokens/creator";
import { Badge, cn, Icon, IconButton, initialsOf, Spinner, toast } from "@linkyo/ui";
import { Check, ChevronLeft, ChevronRight, CircleDashed, CircleCheck, ImageOff, ImagePlus, Link2, PencilLine } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useContext, useId, useState } from "react";

import { blockIcon } from "@/features/directions/editor/ui";
import { remoteImageProps, resolveMedia } from "@/features/directions/shared/media";
import { Link } from "@/i18n/navigation";
import { supabaseEnabled } from "@/lib/supabase/config";

import { blankBlock, insertAt, newBlockId } from "./blocks";
import { ImageError, pickFiles, prepareAndStore, projectPictureLimit, workImageKind } from "./images";
import { isPortfolioKind } from "./kinds";
import { ListGroup, ListRow } from "./list";
import { useMediaOwner } from "./media-owner";
import { PreviewButton } from "./preview";
import { projectFromPictures, startedBlock } from "./project-form";
import { projectRuns } from "./project-runs";
import { TAB_HREF, WORK_HREF } from "./routes";
import { Panel, Screen, UndoRedo } from "./screen";
import { OpenAddContext } from "./shell";
import { useSite } from "./site-context";
import { inPage } from "./validate";

type Project = BlockOf<"project">;

// ─── Rules (pure; work-screen.test.ts) ────────────────────────────────────────────────────────

const filled = (text: string | undefined): boolean => (text ?? "").trim().length > 0;

/** The page's projects, in page order. */
export const projectsOf = (blocks: readonly Block[]): Project[] => blocks.filter((block): block is Project => block.type === "project");

/**
 * Pictures of a project that wait for a description, as the page counts them: the cover and every
 * picture without one (pictures marked decorative need none). The page leaves those pictures out.
 */
export function missingAlt(project: Project): number {
  const cover = hasImage(project.cover) && !filled(project.cover.alt) ? 1 : 0;
  const pictures = (project.pictures ?? []).filter((picture) => hasImage(picture.image) && !filled(picture.image.alt) && picture.decorative !== true).length;
  return cover + pictures;
}

/** Whether the page has an "Arbeiten" view: a page made to show work, or any page with a project. */
export const showsWork = (kind: CreatorKind | undefined, blocks: readonly Block[]): boolean => isPortfolioKind(kind) || blocks.some((block) => block.type === "project");

/**
 * The blocks with a project swapped with the project before it (-1) or after it (1). Everything
 * else stays where it is, so a project never leaves the place between other blocks it was in. Null
 * at either end (nothing to swap with) or for an id that is not a project.
 */
export function swapProject(blocks: readonly Block[], id: string, delta: -1 | 1): Block[] | null {
  const places = blocks.flatMap((block, index) => (block.type === "project" ? [index] : []));
  const at = places.findIndex((index) => blocks[index]?.id === id);
  const from = places[at];
  const to = places[at + delta];
  if (at < 0 || from === undefined || to === undefined) return null;
  const next = [...blocks];
  const moving = next[from];
  const other = next[to];
  if (!moving || !other) return null;
  next[from] = other;
  next[to] = moving;
  return next;
}

/**
 * Where a new project goes: in front of the first project (the newest leads, and it stays in the
 * section the projects are in), else where the Add sheet puts new blocks.
 */
export function newProjectIndex(blocks: readonly Block[]): number {
  const first = blocks.findIndex((block) => block.type === "project");
  return first >= 0 ? first : insertAt(blocks);
}

// ─── Pieces shared with the editor and Design ───────────────────────────────────────────────

/**
 * "Inhalte | Arbeiten": the two views of the Page tab, at the top of both, for pages that show work.
 * Two links (each view has its own address), drawn like the segmented control; the current one is
 * marked by its fill, its edge and a semibold label, never by colour alone.
 */
export function PageViews({ current }: { current: "content" | "work" }) {
  const t = useTranslations("app");
  const { doc, site } = useSite();
  if (!showsWork(site.kind as CreatorKind | undefined, doc.blocks)) return null;
  const views = [
    { key: "content", href: TAB_HREF.page, label: t("editor.blocks") },
    { key: "work", href: WORK_HREF, label: t("work.title") },
  ] as const;
  return (
    <nav aria-label={t("work.viewsLabel")}>
      {/* Safari (VoiceOver) drops the list semantics of a <ul> without bullets unless the role is set. */}
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- see above */}
      <ul role="list" className="flex h-control-md w-full items-stretch gap-0.5 rounded-md bg-hover p-0.5 pointer-coarse:h-control-lg sm:inline-flex sm:w-auto">
        {views.map((view) => {
          const here = view.key === current;
          return (
            <li key={view.key} className="flex min-w-0 flex-1 sm:flex-none">
              <Link
                href={view.href}
                aria-current={here ? "page" : undefined}
                className={cn(
                  "inline-flex min-w-0 flex-1 items-center justify-center rounded-sm border px-4 text-small whitespace-nowrap transition-[background-color,border-color,color] duration-micro ease-standard focus-visible:focus-ring",
                  here ? "border-line-input bg-surface-elevated font-semibold text-fg" : "border-transparent font-medium text-fg-secondary hover:text-fg",
                  // Forced colours flatten fills and borders to one system colour: an outline keeps the choice visible.
                  here && "forced-colors:outline",
                )}
              >
                {view.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * How the page lays out its work: the template's choice ("Automatic") or the owner's. A choice the
 * content cannot fill falls back to the list on the page; one line says why. Writes `theme.projects`.
 * On Design (with the look) and on Arbeiten (with the work).
 */
export function WorkLayoutControl() {
  const t = useTranslations("app.design.projects");
  const { doc, dispatch } = useSite();
  const id = useId();
  const theme = doc.theme;
  const projects: ProjectsStyle = theme.projects ?? "auto";
  // As the page shows it: hidden and scheduled projects do not count.
  const forced = projects !== "auto" && projectRuns(doc.blocks, projects).layouts.some((layout) => layout !== projects);
  const choose = (style: ProjectsStyle) => {
    const { projects: _old, ...rest } = theme;
    dispatch({ type: "theme", theme: style === "auto" ? rest : { ...rest, projects: style } });
  };
  return (
    <Panel title={t("label")} id={`${id}-projects`}>
      <fieldset className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <legend className="sr-only">{t("label")}</legend>
        {PROJECTS_STYLES.map((style) => {
          const checked = projects === style;
          return (
            <label
              key={style}
              className={cn(
                "relative flex min-h-control-xl cursor-pointer items-start gap-3 rounded-lg border p-3 transition-[background-color,border-color] duration-micro has-[:focus-visible]:focus-ring",
                checked ? "border-focus bg-selected" : "border-line bg-surface hover:border-line-input",
              )}
            >
              <input type="radio" name={`${id}-projects`} value={style} checked={checked} onChange={() => choose(style)} className="sr-only" />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-small font-semibold">{t(style)}</span>
                <span className="text-caption text-fg-secondary">{t(`${style}Hint`)}</span>
              </span>
              {checked ? <Icon icon={Check} size="sm" className="mt-0.5 shrink-0" /> : null}
            </label>
          );
        })}
      </fieldset>
      {/* Always there, so the line is read out when a choice makes it appear. */}
      <p role="status" className="text-small font-regular text-fg-secondary empty:hidden">
        {forced ? t("forced") : null}
      </p>
    </Panel>
  );
}

/**
 * The three ways to add a piece of work: type it (the project form), from photos (picked right
 * here, the first one is the cover) or from a link (the Add sheet's link door, which makes a project
 * of it). A new project goes in front of the first one.
 */
export function AddWorkWays() {
  const t = useTranslations("app.work.add");
  const tPortfolio = useTranslations("app.portfolio");
  const tAdd = useTranslations("app.add");
  const { doc, site, edit } = useSite();
  const openAdd = useContext(OpenAddContext);
  const owner = useMediaOwner();
  const [uploading, setUploading] = useState(false);
  const kind = site.kind as CreatorKind | undefined;
  const index = newProjectIndex(doc.blocks);

  const type = () => {
    const blank = blankBlock("project", { artist: doc.profile.displayName, newsletter: "" });
    edit({ mode: "create", block: inPage(startedBlock(blank, kind, (key) => tPortfolio(key as "sentence")), doc.blocks), index });
  };

  // The picker opens from this tap (browsers open a file picker only from one).
  const photos = async () => {
    const files = await pickFiles({ multiple: true });
    if (files.length === 0) return;
    const real = supabaseEnabled;
    // A project keeps its cover and as many pictures as it holds: only those are prepared and stored.
    const cap = projectPictureLimit(real) + 1;
    setUploading(true);
    try {
      const images = await Promise.all(files.slice(0, cap).map((file) => prepareAndStore(file, workImageKind(real), owner)));
      edit({ mode: "create", block: inPage(projectFromPictures(newBlockId("project"), images, real), doc.blocks), index });
      // The demo says why some were left out; a real account sees "20 of 20" on the Pictures row.
      if (files.length > cap && !real) toast({ title: tPortfolio("demoPictures") });
    } catch (problem) {
      toast({ title: tAdd(`imageErrors.${problem instanceof ImageError ? problem.reason : "decode"}`), tone: "danger" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <ListGroup title={t("title")}>
      <ListRow icon={PencilLine} title={t("type")} subtitle={t("typeHint")} onClick={type} />
      <ListRow icon={ImagePlus} title={t("photos")} subtitle={t("photosHint")} value={uploading ? <Spinner className="size-icon-sm" /> : undefined} onClick={() => void photos()} />
      {openAdd ? <ListRow icon={Link2} title={t("link")} subtitle={t("linkHint")} onClick={() => openAdd("workLink", index)} /> : null}
    </ListGroup>
  );
}

// ─── The screen ───────────────────────────────────────────────────────────────────────────────

/**
 * "Arbeiten": every project of the page as a cover (two columns on a phone, four on a laptop) with
 * its title, its years, its one next step and how many of its pictures wait for a description. The
 * arrows change the order (one undo each), a tap opens the project, and the three ways to add and the
 * work layout sit below. The counts above say what is there, hidden projects included.
 */
export function WorkScreen() {
  const t = useTranslations("app.work");
  const { doc } = useSite();
  const projects = projectsOf(doc.blocks);
  const hidden = projects.filter((project) => !project.visible).length;
  const waiting = projects.reduce((sum, project) => sum + missingAlt(project), 0);
  const lead = [t("count", { count: projects.length }), ...(hidden > 0 ? [t("hidden", { count: hidden })] : []), ...(waiting > 0 ? [t("altMissing", { count: waiting })] : [])].join(" · ");

  return (
    <Screen
      title={t("title")}
      lead={projects.length > 0 ? lead : undefined}
      preview
      actions={
        <>
          <UndoRedo />
          {/* The page shows beside the screen from the desk width; phones have the top bar's eye. */}
          <PreviewButton className="hidden lg:inline-grid desk:hidden" />
        </>
      }
    >
      <PageViews current="work" />
      {projects.length === 0 ? (
        <section aria-labelledby="work-empty-title" className="grid justify-items-center gap-2 rounded-lg border border-dashed border-line-strong p-8 text-center">
          <h2 id="work-empty-title" className="text-title rtl:tracking-normal">
            {t("empty.title")}
          </h2>
          <p className="max-w-prose text-small font-regular text-fg-secondary">{t("empty.body")}</p>
        </section>
      ) : (
        <div className="@container">
          {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari (VoiceOver) drops the list semantics without it */}
          <ul role="list" aria-label={t("title")} className="grid grid-cols-2 gap-3 @creator:grid-cols-3 @prose:grid-cols-4">
            {projects.map((project, index) => (
              <WorkCard key={project.id} project={project} position={index} count={projects.length} />
            ))}
          </ul>
        </div>
      )}
      <AddWorkWays />
      {projects.length > 0 ? <WorkLayoutControl /> : null}
    </Screen>
  );
}

/** What a card shows for a project without a picture: its initials, as the editor's row does. */
function Cover({ project }: { project: Project }) {
  const image = coverImage(project);
  if (hasImage(image)) {
    const src = resolveMedia(image.src);
    return <Image src={src} alt="" fill sizes="(min-width: 64rem) 12rem, 45vw" className="object-cover" {...remoteImageProps(src)} />;
  }
  return (
    <span aria-hidden className="grid size-full place-items-center bg-tinted text-h3 font-semibold text-tinted-fg">
      {initialsOf(project.title) || <Icon icon={blockIcon.project} size="lg" />}
    </span>
  );
}

function WorkCard({ project, position, count }: { project: Project; position: number; count: number }) {
  const t = useTranslations("app.work");
  const tEditor = useTranslations("app.editor");
  const tCreator = useTranslations("creator.portfolio");
  const { doc, dispatch, edit, announce } = useSite();
  const metaId = useId();
  const title = project.title.trim() || t("untitled");
  const step: ProjectStep | null = nextStep(project);
  const waiting = missingAlt(project);

  const move = (delta: -1 | 1) => {
    const blocks = swapProject(doc.blocks, project.id, delta);
    if (!blocks) return;
    dispatch({ type: "replace", doc: { ...doc, blocks } });
    announce(t("moved", { title, position: position + delta + 1, count }));
  };

  return (
    <li className="group relative grid min-w-0 content-start gap-2 rounded-lg bg-group p-2 lg:border lg:border-line">
      <span className={cn("relative block aspect-portrait overflow-hidden rounded-md bg-canvas-muted", !project.visible && "opacity-secondary")}>
        <Cover project={project} />
      </span>
      {/* The whole card opens the project; the arrows below sit above that button. */}
      <button
        type="button"
        onClick={() => edit({ mode: "edit", id: project.id })}
        aria-label={t("open", { title })}
        aria-describedby={metaId}
        className={cn(
          "min-w-0 rounded-sm px-1 text-start focus-visible:outline-none",
          "after:absolute after:inset-0 after:rounded-lg after:transition-colors after:duration-micro group-hover:after:bg-hover active:after:bg-pressed focus-visible:after:focus-field",
        )}
      >
        <span dir="auto" className="line-clamp-2 text-small font-semibold break-words text-start">
          {title}
        </span>
      </button>
      <span id={metaId} className="pointer-events-none grid min-w-0 gap-1 px-1 text-caption text-fg-secondary">
        {!project.visible || project.year ? (
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {!project.visible ? <Badge size="sm">{tEditor("hidden")}</Badge> : null}
            {project.year ? <bdi className="tabular-nums">{formatYears(project.year, tCreator("untilNow"))}</bdi> : null}
          </span>
        ) : null}
        <span className="flex min-w-0 items-start gap-2">
          <Icon icon={step ? CircleDashed : CircleCheck} size="sm" className={cn("mt-0.5 shrink-0", !step && "text-success-strong")} />
          <span className="min-w-0">
            {step ? <span className="sr-only">{t("nextLabel")}: </span> : null}
            {step ? t(`next.${step}`) : t("complete")}
          </span>
        </span>
        {waiting > 0 ? (
          <span className="flex min-w-0 items-start gap-2">
            <Icon icon={ImageOff} size="sm" className="mt-0.5 shrink-0" />
            <span className="min-w-0">{t("altMissing", { count: waiting })}</span>
          </span>
        ) : null}
      </span>
      {count > 1 ? (
        // Earlier and later in reading order: the arrows point the other way in Arabic.
        <span className="layer-raised relative flex justify-end gap-1">
          <IconButton icon={ChevronLeft} size="sm" label={t("moveEarlier", { title })} disabled={position === 0} onClick={() => move(-1)} />
          <IconButton icon={ChevronRight} size="sm" label={t("moveLater", { title })} disabled={position === count - 1} onClick={() => move(1)} />
        </span>
      ) : null}
    </li>
  );
}
