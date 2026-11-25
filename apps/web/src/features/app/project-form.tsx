"use client";

import {
  CODE_LANGS,
  coverImage,
  FALLBACK_SLUG,
  formatYears,
  hasImage,
  nextStep,
  shownPictures,
  slugFor,
  slugWord,
  type Block,
  type BlockOf,
  type CodeLang,
  type CreatorKind,
  type ProjectStep,
} from "@linkyo/blocks";
import { Button, cn, Icon, IconButton } from "@linkyo/ui";
import { ArrowRight, ChevronLeft, ChevronRight, Crosshair, ImagePlus, Plus, RefreshCw, StarOff } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { remoteImageProps, resolveMedia } from "@/features/directions/shared/media";
import { supabaseEnabled } from "@/lib/supabase/config";

import { ChipsInput } from "./chips-input";
import { FocalInput } from "./focal-input";
import { ImageInput, Repeater, SelectField, SwitchRow, TextArea, TextInput, UrlInput, type ImageValue } from "./form";
import { ImageError, pickFiles, prepareAndStore, projectPictureLimit, storedImage, workImageKind, type PreparedImage } from "./images";
import { useMediaOwner } from "./media-owner";
import { fetchLinkMetadata, type LinkMetadata } from "./metadata";
import { useSite } from "./site-context";
import { slugProblem, type FieldErrors } from "./validate";

export type Project = BlockOf<"project">;
type Picture = NonNullable<Project["pictures"]>[number];
type Figure = NonNullable<Project["results"]>[number];

// ─── Rules (pure; project-form.test.ts) ────────────────────────────────────────────────────────

/** Every address on the page that another project uses: current ones and earlier ones. */
export const takenAddresses = (blocks: readonly Block[], id: string): string[] =>
  blocks.flatMap((block) => (block.type === "project" && block.id !== id ? [block.slug, ...(block.was ?? [])] : []));

/**
 * A new title. The address is made from the title when the project is first saved, so until then
 * it follows the title (unless the owner typed one); once saved it never follows the title again:
 * a shared link must not break because a typo was fixed.
 */
export function withTitle(project: Project, title: string, blocks: readonly Block[], word: string): Project {
  const saved = blocks.some((block) => block.id === project.id);
  if (saved && project.slug) return { ...project, title };
  const taken = takenAddresses(blocks, project.id);
  const following = project.slug === "" || project.slug === slugFor(project.title, taken, word, project.source?.repo);
  return following ? { ...project, title, slug: slugFor(title, taken, word, project.source?.repo) } : { ...project, title };
}

/**
 * The owner changes the address. Once the project is on the page, the address it had there keeps
 * redirecting (`was`, newest first, at most three); taking back one of those earlier addresses
 * removes it from the list. Before the first save nothing was ever published, so nothing is kept.
 */
export function changeSlug(project: Project, slug: string, saved: Project | undefined): Project {
  if (!saved?.slug) return { ...project, slug };
  const was = [...new Set([saved.slug, ...(saved.was ?? [])])].filter((old) => old !== slug).slice(0, 3);
  const { was: _old, ...rest } = project;
  return was.length > 0 ? { ...rest, slug, was } : { ...rest, slug };
}

/** The project whose earlier address this is, if another one had it ("This address used to belong to …"). */
export const formerOwner = (slug: string, id: string, blocks: readonly Block[]): Project | undefined =>
  blocks.find((block): block is Project => block.type === "project" && block.id !== id && (block.was ?? []).includes(slug));

/**
 * After a project took over another one's earlier address, that address leads to it alone: the
 * fixes remove it from the other project's list. Every producer repairs before the page rules run.
 */
export function releasedAddresses(blocks: readonly Block[]): { id: string; was: string[] | undefined }[] {
  const current = new Set(blocks.flatMap((block) => (block.type === "project" ? [block.slug] : [])));
  return blocks.flatMap((block) => {
    if (block.type !== "project" || !block.was?.some((old) => current.has(old))) return [];
    const was = block.was.filter((old) => !current.has(old));
    return [{ id: block.id, was: was.length > 0 ? was : undefined }];
  });
}

/** "Confidential" on clears the client's name: page JSON is public, so the name is never stored. */
export function setConfidential(project: Project, on: boolean): Project {
  const { client: _client, confidential: _confidential, ...rest } = project;
  return on ? { ...rest, confidential: true } : project.client ? { ...rest, client: project.client } : rest;
}

/** New pictures at the end, as many as the project still takes (`projectPictureLimit`), with their size. */
export function addPictures(project: Project, prepared: readonly PreparedImage[], real: boolean): Project {
  const room = Math.max(0, projectPictureLimit(real) - (project.pictures?.length ?? 0));
  const added = prepared.slice(0, room).map((image): Picture => ({ image: storedImage(image) }));
  return added.length > 0 ? { ...project, pictures: [...(project.pictures ?? []), ...added] } : project;
}

/** Pictures that wait for a description (the page leaves them out until then). */
export const waitingPictures = (project: Project): number => (project.pictures?.length ?? 0) - shownPictures(project).length;

/**
 * Whether the quick form asks for the address right below the title: a project not yet on the page
 * whose title gives no address to make (no Latin letters), so it would get the fallback "project-n".
 * It stays while the owner types one: the rule reads the title, not the address typed.
 */
export const inlineAddress = (project: Project, saved: Project | undefined, word: string): boolean =>
  !saved && project.title.trim() !== "" && FALLBACK_SLUG.test(slugFor(project.title, [], word, project.source?.repo));

/** A sentence cut to fit a card: at a word where possible, with an ellipsis. */
export function cutSentence(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

const blankProject = (id: string): Project => ({ id, type: "project", visible: true, highlight: false, slug: "", title: "", summary: "" });

/**
 * A project from a repository link: its name, its description as the sentence, its language and up
 * to four topics, the year it was created, the repository's facts and its homepage. It is a card
 * that opens the repository until it has more to read (a code sample, a story, a result).
 */
export function projectFromRepository(
  id: string,
  repository: { url: string; owner: string; repo: string },
  meta: LinkMetadata | null,
  blocks: readonly Block[],
  word: string,
  today: string,
): Project {
  const title = (meta?.title ?? repository.repo).slice(0, 60);
  const tags = [...new Set([meta?.language, ...(meta?.topics ?? []).slice(0, 4)].flatMap((tag) => (tag?.trim() ? [tag.trim().slice(0, 24)] : [])))].slice(0, 5);
  const links: NonNullable<Project["links"]> = [{ url: `https://github.com/${repository.owner}/${repository.repo}` }];
  if (meta?.homepage) links.push({ url: meta.homepage });
  return {
    ...blankProject(id),
    title,
    slug: slugFor(title, takenAddresses(blocks, id), word, repository.repo),
    summary: cutSentence(meta?.description ?? "", 140),
    ...(tags.length > 0 ? { tags } : {}),
    ...(meta?.year ? { year: { from: meta.year } } : {}),
    source: {
      owner: repository.owner,
      repo: repository.repo,
      ...(meta?.stars !== undefined ? { stars: meta.stars } : {}),
      ...(meta?.language ? { language: meta.language.slice(0, 40) } : {}),
      ...(meta?.license ? { license: meta.license.slice(0, 40) } : {}),
      readAt: today,
    },
    links,
  };
}

/** A project from any other link: the link is kept; a title only where the platform gives one. */
export function projectFromLink(id: string, url: string, title: string | undefined, blocks: readonly Block[], word: string): Project {
  const name = (title ?? "").slice(0, 60);
  return { ...blankProject(id), title: name, slug: name ? slugFor(name, takenAddresses(blocks, id), word) : "", links: [{ url }] };
}

/** A project from pictures: the first is the cover, the others its pictures (each waits for a description). */
export function projectFromPictures(id: string, prepared: readonly PreparedImage[], real: boolean): Project {
  const [first, ...rest] = prepared;
  const project: Project = first ? { ...blankProject(id), cover: storedImage(first) } : blankProject(id);
  return addPictures(project, rest, real);
}

/** A new portfolio section as the owner first sees it (`./project-start.ts`). */
export { startedBlock } from "./project-start";

// ─── The sheet ────────────────────────────────────────────────────────────────────────────────

type GroupKey = "result" | "story" | "pictures" | "forRole" | "links" | "code" | "address";
type Panel = GroupKey | "describe" | "focus";

const CODE_KINDS: ReadonlySet<CreatorKind> = new Set<CreatorKind>(["developer", "engineer"]);

/** Which group the one next step opens. */
const STEP_GROUP: Record<ProjectStep, Panel> = {
  address: "address",
  alt: "describe",
  codeOrStory: "code",
  resultOrPicture: "result",
  storyOrLink: "story",
  year: "forRole",
};

const filled = (text: string | undefined): text is string => text !== undefined && text.trim() !== "";
const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/**
 * The project sheet. The quick form first (title, one sentence, a cover): that is all a project
 * needs. Then the one next step, and the rest as groups: an empty group is a chip that opens it, a
 * filled one a row with a one-line summary. A group opens as its own panel with a way back, like a
 * pushed screen on iOS (the chevron mirrors in Arabic).
 */
export function ProjectForm({
  block,
  onChange,
  errors,
  err,
  schedule,
}: {
  block: Project;
  onChange: (block: Project) => void;
  errors: FieldErrors;
  err: (path: string) => string | undefined;
  /** The schedule rows every block has, shown at the end of the overview. */
  schedule: ReactNode;
}) {
  const t = useTranslations("app.portfolio");
  const tFields = useTranslations("app.fields");
  const tEdit = useTranslations("app.edit");
  const tTypes = useTranslations("dashboard.types");
  const { doc, site, account } = useSite();
  const real = supabaseEnabled;
  const word = slugWord(doc.profile.locale);
  const saved = doc.blocks.find((candidate): candidate is Project => candidate.type === "project" && candidate.id === block.id);
  // A save that fails on a field inside a group opens that group, so the field with the error shows.
  const errorGroup = groupOfErrors(errors);
  const [panel, setPanel] = useState<Panel | null>(null);
  // Only when a save has just failed (no problems before, some now): later changes leave the panel be.
  const [shownErrors, setShownErrors] = useState(errors);
  if (shownErrors !== errors) {
    setShownErrors(errors);
    if (Object.keys(shownErrors).length === 0 && errorGroup) setPanel(errorGroup);
  }
  const set = (patch: Partial<Project>) => onChange({ ...block, ...patch });
  const step = nextStep(block);
  const codeShown = CODE_KINDS.has(site.kind as CreatorKind) || block.source !== undefined || block.code !== undefined;
  // A new project whose title gives no address (no Latin letters) asks for one right below the title.
  const showInlineAddress = inlineAddress(block, saved, word);
  // The cover's description field, where the "describe your picture" step leads while the cover waits.
  const coverAltId = useId();

  // Back from a panel returns to the overview where the owner left it: scrolled as it was, with focus
  // on the control that opened the panel (else the group's chip or row, else the title).
  const overview = useRef<HTMLDivElement>(null);
  const opener = useRef<{ selectors: string[]; top: number } | null>(null);
  const shownPanel = useRef<Panel | null>(null);
  const open = (next: Panel, selector?: string) => {
    const body = overview.current?.closest<HTMLElement>("[data-sheet-body]");
    opener.current = { selectors: [...(selector ? [selector] : []), `[data-group="${next}"]`], top: body?.scrollTop ?? 0 };
    setPanel(next);
  };
  useLayoutEffect(() => {
    const left = shownPanel.current;
    shownPanel.current = panel;
    if (panel !== null || left === null) return;
    const root = overview.current;
    if (!root) return;
    const back = opener.current;
    opener.current = null;
    const body = root.closest<HTMLElement>("[data-sheet-body]");
    if (body && back) body.scrollTop = back.top;
    const target = [...(back?.selectors ?? []), "[data-project-title]"].map((selector) => root.querySelector<HTMLElement>(selector)).find((element) => element !== null);
    target?.focus({ preventScroll: back !== null });
  }, [panel]);
  const takeStep = (next: ProjectStep) => {
    // A cover without a description waits on this screen: its field sits right above, no panel holds it.
    if (next === "alt" && hasImage(block.cover) && !filled(block.cover.alt)) {
      const field = document.getElementById(coverAltId);
      field?.scrollIntoView({ block: "center" });
      field?.focus({ preventScroll: true });
      return;
    }
    open(STEP_GROUP[next], "[data-next-step]");
  };

  if (panel) {
    const title =
      panel === "describe" ? t("describeAll") : panel === "focus" ? t("focus.title") : t(`groups.${panel}`);
    // Named by where it leads: in the Add sheet the sheet's own Back, beside it, leaves the form instead.
    const backTo = panel === "describe" ? t("groups.pictures") : block.title.trim() || tTypes("project");
    return (
      <PanelView title={title} back={`${tEdit("back")}: ${backTo}`} onBack={() => setPanel(panel === "describe" ? "pictures" : null)}>
        {panel === "result" ? <ResultFields block={block} set={set} err={err} /> : null}
        {panel === "story" ? <StoryFields block={block} set={set} /> : null}
        {panel === "pictures" ? <PictureFields block={block} onChange={onChange} real={real} onDescribe={() => setPanel("describe")} /> : null}
        {panel === "describe" ? <DescribeAll block={block} onChange={onChange} onDone={() => setPanel("pictures")} /> : null}
        {panel === "focus" ? <FocusFields block={block} onChange={onChange} /> : null}
        {panel === "forRole" ? <ForRoleFields block={block} onChange={onChange} err={err} /> : null}
        {panel === "links" ? <LinkFields block={block} set={set} err={err} /> : null}
        {panel === "code" ? <CodeFields block={block} onChange={onChange} err={err} /> : null}
        {panel === "address" ? <AddressFields block={block} onChange={onChange} saved={saved} username={account.username} err={err} /> : null}
      </PanelView>
    );
  }

  const groups: { key: GroupKey; summary: string | null }[] = [
    { key: "result", summary: resultSummary(block) },
    { key: "story", summary: [block.story?.about, block.story?.problem, block.story?.solution].find(filled) ?? null },
    // Pictures that wait for a description are left off the page: the row says how many, before anything else.
    {
      key: "pictures",
      summary: block.pictures?.length
        ? waitingPictures(block) > 0
          ? t("altMissing", { count: waitingPictures(block) })
          : t("pictureCount", { count: block.pictures.length, max: projectPictureLimit(real) })
        : null,
    },
    { key: "forRole", summary: forRoleSummary(block, t("hideClient"), t("untilToday")) },
    { key: "links", summary: block.links?.length ? block.links.map((link) => link.label ?? hostOf(link.url)).join(" · ") : null },
    ...(codeShown ? [{ key: "code" as const, summary: block.source ? `${block.source.owner}/${block.source.repo}` : (block.code?.file ?? block.code?.lang ?? null) }] : []),
  ];
  const rows = groups.filter((group) => group.summary !== null);
  const chips = groups.filter((group) => group.summary === null);
  const address = showInlineAddress ? [] : [{ key: "address" as const, summary: `linkyo.app/${account.username}/${block.slug}` }];
  const cover = block.cover;

  return (
    <div ref={overview} className="grid grid-cols-1 gap-6">
      {errors.page ? (
        <p role="alert" className="rounded-md border border-danger-strong bg-danger-subtle p-3 text-small">
          {err("page")}
        </p>
      ) : null}
      <TextInput data-project-title label={tFields("title")} value={block.title} onValue={(title) => onChange(withTitle(block, title, doc.blocks, word))} maxLength={60} error={err("title")} />
      {showInlineAddress ? <AddressFields block={block} onChange={onChange} saved={saved} username={account.username} err={err} inline /> : null}
      <TextArea label={t("sentence")} hint={t("sentenceHint")} value={block.summary} onValue={(summary) => set({ summary: summary.replace(/\n/g, " ") })} max={140} rows={2} count error={err("summary")} />
      <div className="grid grid-cols-1 gap-3">
        <ImageInput
          label={tFields("cover")}
          hint={t("coverHint")}
          kind={workImageKind(real)}
          shape="wide"
          image={cover}
          altId={coverAltId}
          altLabel={t("alt")}
          altHint={t("altHint")}
          onImage={(image) => {
            const { cover: _cover, ...rest } = block;
            onChange(image ? { ...rest, cover: image } : rest);
          }}
        />
        {/* The picture the cards show: the cover, else the first picture. */}
        {coverImage(block) ? (
          <Button type="button" variant="ghost" icon={Crosshair} data-group="focus" className="justify-self-start" onClick={() => open("focus")}>
            {t("focus.open")}
          </Button>
        ) : null}
      </div>

      {step ? (
        <button
          type="button"
          data-next-step={step}
          onClick={() => takeStep(step)}
          className="flex min-h-touch-target items-center gap-2 justify-self-start rounded-xs text-start text-small font-semibold text-fg transition-colors duration-micro hover:text-link-hover focus-visible:focus-ring"
        >
          <Icon icon={ArrowRight} size="sm" className="shrink-0" />
          {t(`next.${step}`)}
        </button>
      ) : null}

      <GroupRows rows={rows} onOpen={open} />
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((group) => (
            <button
              key={group.key}
              type="button"
              data-group={group.key}
              onClick={() => open(group.key)}
              className="inline-flex min-h-touch-target items-center gap-2 rounded-full border border-line-strong px-4 text-small font-medium transition-colors duration-micro hover:border-line-input hover:bg-hover focus-visible:focus-ring"
            >
              <Icon icon={Plus} size="sm" />
              {t(`groups.${group.key}`)}
            </button>
          ))}
        </div>
      ) : null}
      {/* The address closes the list: it is there from the start, and rarely needs a change. */}
      <GroupRows rows={address} onOpen={open} ltr />
      {schedule}
    </div>
  );
}

/** Filled groups as rows: the group's name, a one-line summary, and the way in. */
function GroupRows({ rows, onOpen, ltr = false }: { rows: { key: GroupKey; summary: string | null }[]; onOpen: (key: GroupKey) => void; ltr?: boolean }) {
  const t = useTranslations("app.portfolio");
  if (rows.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 overflow-hidden rounded-lg border border-line bg-surface">
      {rows.map((group, index) => (
        <li key={group.key} className={cn(index > 0 && "border-t border-line")}>
          <button
            type="button"
            data-group={group.key}
            onClick={() => onOpen(group.key)}
            className="flex min-h-control-xl w-full items-center gap-3 px-4 py-2 text-start transition-colors duration-micro hover:bg-hover focus-visible:focus-ring"
          >
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="text-body font-medium">{t(`groups.${group.key}`)}</span>
              {group.summary ? (
                <span dir={ltr ? "ltr" : "auto"} className="truncate text-start text-small text-fg-secondary">
                  {group.summary}
                </span>
              ) : null}
            </span>
            <Icon icon={ChevronRight} size="md" className="shrink-0 text-fg-tertiary" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The group a field error lives in, so a failed save shows it. */
function groupOfErrors(errors: FieldErrors): GroupKey | null {
  const paths = Object.keys(errors);
  const has = (prefix: string) => paths.some((path) => path === prefix || path.startsWith(`${prefix}.`));
  if (has("title") || has("summary") || has("page")) return null;
  if (has("results") || has("story.result")) return "result";
  if (has("story")) return "story";
  if (has("pictures")) return "pictures";
  if (has("client") || has("role") || has("year") || has("tags")) return "forRole";
  if (has("links")) return "links";
  if (has("code") || has("source")) return "code";
  if (has("slug") || has("was")) return "address";
  return null;
}

function resultSummary(block: Project): string | null {
  const figures = (block.results ?? []).map((figure) => `${figure.value} ${figure.label}`.trim()).filter(Boolean);
  if (figures.length > 0) return figures.join(" · ");
  return filled(block.story?.result) ? block.story.result : null;
}

function forRoleSummary(block: Project, confidential: string, now: string): string | null {
  const parts = [block.confidential ? confidential : block.client, block.role, block.year ? formatYears(block.year, now) : undefined, ...(block.tags ?? [])].filter(filled);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** A pushed panel: the way back and the group's title, then its fields. Focus starts on the title. */
function PanelView({ title, back, onBack, children }: { title: string; back: string; onBack: () => void; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.closest("[data-sheet-body]")?.scrollTo({ top: 0 });
  }, [title]);
  return (
    <div data-panel className="grid grid-cols-1 gap-5">
      <div className="flex items-center gap-2">
        <IconButton icon={ChevronLeft} label={back} variant="tinted" className="shrink-0 rounded-full" onClick={onBack} />
        <h3 ref={heading} tabIndex={-1} className="min-w-0 flex-1 text-h3 outline-none">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function ResultFields({ block, set, err }: { block: Project; set: (patch: Partial<Project>) => void; err: (path: string) => string | undefined }) {
  const t = useTranslations("app.portfolio");
  return (
    <>
      <p className="text-small font-regular text-fg-secondary">{t("figuresHint")}</p>
      <Repeater<Figure>
        items={block.results ?? []}
        onItems={(results) => set({ results: results.length > 0 ? results : undefined })}
        make={() => ({ value: "", label: "" })}
        max={3}
        itemLabel={(figure, index) => figure.value || `${t("figureValue")} ${String(index + 1)}`}
        addLabel={t("addFigure")}
        render={(figure, update, index) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_3fr]">
            <TextInput label={t("figureValue")} value={figure.value} onValue={(value) => update({ ...figure, value })} maxLength={12} error={err(`results.${String(index)}.value`)} />
            <TextInput label={t("figureLabel")} value={figure.label} onValue={(label) => update({ ...figure, label })} maxLength={24} error={err(`results.${String(index)}.label`)} />
          </div>
        )}
      />
      <TextArea label={t("resultText")} value={block.story?.result ?? ""} onValue={(result) => set({ story: storyWith(block, "result", result) })} max={600} rows={3} />
    </>
  );
}

/** The story with one part changed; empty parts are dropped, and an empty story with them. */
function storyWith(block: Project, part: "about" | "problem" | "solution" | "result", text: string): Project["story"] {
  const story = { ...block.story, [part]: text };
  const kept = Object.fromEntries(Object.entries(story).filter(([, value]) => typeof value === "string" && value !== ""));
  return Object.keys(kept).length > 0 ? kept : undefined;
}

function StoryFields({ block, set }: { block: Project; set: (patch: Partial<Project>) => void }) {
  const t = useTranslations("app.portfolio");
  return (
    <>
      <TextArea label={t("storyAbout")} value={block.story?.about ?? ""} onValue={(text) => set({ story: storyWith(block, "about", text) })} max={600} rows={4} />
      <TextArea label={t("storyProblem")} value={block.story?.problem ?? ""} onValue={(text) => set({ story: storyWith(block, "problem", text) })} max={600} rows={4} />
      <TextArea label={t("storySolution")} value={block.story?.solution ?? ""} onValue={(text) => set({ story: storyWith(block, "solution", text) })} max={600} rows={4} />
    </>
  );
}

/** A small picture in a row (dashboard chrome: no description of its own, the row names it). */
function Thumbnail({ image, className, natural = false }: { image: ImageValue; className?: string; natural?: boolean }) {
  const resolved = resolveMedia(image.src);
  const ratio = natural && image.w && image.h ? `${String(image.w)} / ${String(image.h)}` : undefined;
  return (
    <span style={ratio ? { aspectRatio: ratio } : undefined} className={cn("relative block shrink-0 overflow-hidden rounded-sm border border-line bg-canvas-muted", natural && !ratio && "aspect-photo", className)}>
      <Image src={resolved} alt="" fill sizes="8rem" className="object-cover" {...remoteImageProps(resolved)} />
    </span>
  );
}

function PictureFields({ block, onChange, real, onDescribe }: { block: Project; onChange: (block: Project) => void; real: boolean; onDescribe: () => void }) {
  const t = useTranslations("app.portfolio");
  const tFields = useTranslations("app.fields");
  const tForm = useTranslations("app.form");
  const owner = useMediaOwner();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const pictures = block.pictures ?? [];
  const limit = projectPictureLimit(real);
  const waiting = waitingPictures(block);
  const add = async () => {
    const files = await pickFiles({ multiple: true });
    if (files.length === 0) return;
    setBusy(true);
    try {
      const room = Math.max(0, limit - pictures.length);
      const prepared = await Promise.all(files.slice(0, room).map((file) => prepareAndStore(file, workImageKind(real), owner)));
      setProblem(null);
      onChange(addPictures(block, prepared, real));
    } catch (reason) {
      setProblem(tForm(`imageErrors.${reason instanceof ImageError ? reason.reason : "decode"}`));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <p className="text-small font-regular text-fg-secondary">{t("rights")}</p>
      {real ? null : <p className="text-small font-regular text-fg-secondary">{t("demoPictures")}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="tinted" icon={ImagePlus} loading={busy} disabled={pictures.length >= limit} onClick={() => void add()}>
          {t("addPictures")}
        </Button>
        <span className="text-small text-fg-secondary tabular-nums">{t("pictureCount", { count: pictures.length, max: limit })}</span>
      </div>
      {problem ? (
        <p role="alert" className="text-small text-danger-strong">
          {problem}
        </p>
      ) : null}
      {waiting > 0 ? (
        <div className="grid grid-cols-1 gap-3 rounded-md border border-line-strong bg-surface p-3">
          <p data-alt-missing className="text-small">
            {t("altMissing", { count: waiting })}
          </p>
          <Button type="button" variant="primary" className="justify-self-start" onClick={onDescribe}>
            {t("describeAll")}
          </Button>
        </div>
      ) : null}
      <Repeater<Picture>
        items={pictures}
        onItems={(next) => onChange(next.length > 0 ? { ...block, pictures: next } : withoutPictures(block))}
        make={() => ({ image: { src: "", alt: "" } })}
        max={0}
        itemLabel={(_, index) => tFields("photoN", { n: index + 1 })}
        addLabel={t("addPictures")}
        render={(picture, update) => (
          <div className="grid grid-cols-1 gap-4">
            <Thumbnail image={picture.image} className="aspect-photo w-32" />
            <TextInput
              label={t("alt")}
              hint={t("altHint")}
              value={picture.image.alt}
              disabled={picture.decorative === true}
              onValue={(alt) => update({ ...picture, image: { ...picture.image, alt } })}
              maxLength={300}
            />
            <SwitchRow label={t("noAlt")} checked={picture.decorative === true} onChecked={(on) => update(on ? { ...picture, decorative: true } : withoutDecorative(picture))} />
            <TextInput label={t("caption")} value={picture.caption ?? ""} onValue={(caption) => update(caption ? { ...picture, caption } : withoutCaption(picture))} maxLength={120} />
          </div>
        )}
      />
    </>
  );
}

const withoutPictures = (block: Project): Project => {
  const { pictures: _pictures, ...rest } = block;
  return rest;
};
const withoutDecorative = (picture: Picture): Picture => {
  const { decorative: _decorative, ...rest } = picture;
  return rest;
};
const withoutCaption = (picture: Picture): Picture => {
  const { caption: _caption, ...rest } = picture;
  return rest;
};

/**
 * "Describe all": the pictures that wait for a description, one after the other. Each starts with
 * its caption as a first draft; "Needs no description" is one tap. Done goes on to the next.
 */
function DescribeAll({ block, onChange, onDone }: { block: Project; onChange: (block: Project) => void; onDone: () => void }) {
  const t = useTranslations("app.portfolio");
  const pictures = block.pictures ?? [];
  const index = pictures.findIndex((picture) => !filled(picture.image.alt) && picture.decorative !== true);
  const picture = pictures[index];
  const [text, setText] = useState({ index, value: picture?.caption ?? "" });
  if (text.index !== index) setText({ index, value: picture?.caption ?? "" });
  // Done (or "Needs no description") moves on to the next picture: focus goes to its description
  // field, as the button that had it is now disabled. The first picture keeps the panel's own focus.
  const fields = useRef<HTMLDivElement>(null);
  const shown = useRef(index);
  useEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    fields.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [index]);
  useEffect(() => {
    if (index < 0) onDone();
  }, [index, onDone]);
  if (!picture) return null;
  const update = (next: Picture) => onChange({ ...block, pictures: pictures.map((candidate, i) => (i === index ? next : candidate)) });
  const describe = () => {
    if (text.value.trim()) update({ ...picture, image: { ...picture.image, alt: text.value.trim() } });
  };
  const waiting = waitingPictures(block);
  return (
    <div ref={fields} className="grid grid-cols-1 gap-4">
      <p className="text-small text-fg-secondary tabular-nums" aria-live="polite">
        {t("altMissing", { count: waiting })}
      </p>
      <Thumbnail image={picture.image} natural className="max-h-[50dvh] w-full [&_img]:object-contain" />
      <TextInput
        label={t("alt")}
        hint={t("altHint")}
        value={text.value}
        onValue={(value) => setText({ index, value })}
        maxLength={300}
        enterKeyHint="next"
        onKeyDown={(event) => {
          // Enter describes this picture and goes on to the next, as Done does; it does not save the sheet.
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            describe();
          }
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" disabled={!text.value.trim()} onClick={describe}>
          {t("focus.done")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => update({ ...picture, decorative: true })}>
          {t("noAlt")}
        </Button>
      </div>
    </div>
  );
}

/**
 * The card picture (`coverImage`: the cover, else the first picture) with a new focal point; none is
 * the centre. The other pictures keep theirs.
 */
export function withFocal(block: Project, focal: [number, number] | undefined): Project {
  const moved = <I extends { focal?: [number, number] | undefined }>(image: I): I => {
    const { focal: _focal, ...rest } = image;
    return (focal ? { ...rest, focal } : rest) as I;
  };
  if (hasImage(block.cover)) return { ...block, cover: moved(block.cover) };
  const [first, ...rest] = block.pictures ?? [];
  if (!first || !hasImage(first.image)) return block;
  return { ...block, pictures: [{ ...first, image: moved(first.image) }, ...rest] };
}

/** The focal point of the picture cards show: the cover, else the first picture. */
function FocusFields({ block, onChange }: { block: Project; onChange: (block: Project) => void }) {
  const image = coverImage(block);
  if (!image) return null;
  return <FocalInput image={image} onFocal={(focal) => onChange(withFocal(block, focal))} />;
}

function ForRoleFields({ block, onChange, err }: { block: Project; onChange: (block: Project) => void; err: (path: string) => string | undefined }) {
  const t = useTranslations("app.portfolio");
  const tFields = useTranslations("app.fields");
  const set = (patch: Partial<Project>) => onChange({ ...block, ...patch });
  const year = (text: string): number | undefined => {
    const value = Number.parseInt(text, 10);
    return Number.isInteger(value) ? value : undefined;
  };
  const from = block.year?.from;
  const to = block.year?.to;
  const setYears = (nextFrom: number | undefined, nextTo: number | "now" | undefined) => {
    const { year: _year, ...rest } = block;
    onChange(nextFrom === undefined ? rest : { ...rest, year: nextTo === undefined ? { from: nextFrom } : { from: nextFrom, to: nextTo } });
  };
  return (
    <>
      <TextInput
        label={t("client")}
        hint={t("clientHint")}
        value={block.client ?? ""}
        disabled={block.confidential === true}
        onValue={(client) => {
          const { client: _client, ...rest } = block;
          onChange(client ? { ...rest, client } : rest);
        }}
        maxLength={60}
        error={err("client")}
      />
      <SwitchRow label={t("hideClient")} description={t("hideClientHint")} checked={block.confidential === true} onChecked={(on) => onChange(setConfidential(block, on))} />
      <TextInput
        label={tFields("role")}
        hint={t("roleHint")}
        value={block.role ?? ""}
        onValue={(role) => {
          const { role: _role, ...rest } = block;
          onChange(role ? { ...rest, role } : rest);
        }}
        maxLength={60}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextInput label={t("yearFrom")} type="number" inputMode="numeric" min={1950} max={2100} value={from === undefined ? "" : String(from)} onValue={(text) => setYears(year(text), to)} error={err("year.from")} />
        <TextInput
          label={t("yearTo")}
          type="number"
          inputMode="numeric"
          min={1950}
          max={2100}
          value={typeof to === "number" ? String(to) : ""}
          disabled={to === "now" || from === undefined}
          onValue={(text) => setYears(from, year(text))}
          error={err("year.to")}
        />
      </div>
      <SwitchRow label={t("untilToday")} checked={to === "now"} disabled={from === undefined} onChecked={(on) => setYears(from, on ? "now" : undefined)} />
      <ChipsInput
        label={t("topics")}
        hint={t("topicsHint")}
        values={block.tags ?? []}
        onValues={(tags) => set({ tags: tags.length > 0 ? tags : undefined })}
        max={5}
        maxLength={24}
      />
    </>
  );
}

function LinkFields({ block, set, err }: { block: Project; set: (patch: Partial<Project>) => void; err: (path: string) => string | undefined }) {
  const t = useTranslations("app.portfolio");
  const tFields = useTranslations("app.fields");
  type ProjectLink = NonNullable<Project["links"]>[number];
  return (
    <Repeater<ProjectLink>
      items={block.links ?? []}
      onItems={(links) => set({ links: links.length > 0 ? links : undefined })}
      make={() => ({ url: "" })}
      max={2}
      itemLabel={(link, index) => (link.url ? hostOf(link.url) : `${tFields("url")} ${String(index + 1)}`)}
      addLabel={tFields("url")}
      render={(link, update, index) => (
        <>
          <UrlInput label={tFields("url")} value={link.url} onValue={(url) => update({ ...link, url })} error={err(`links.${String(index)}.url`)} />
          <TextInput
            label={t("linkLabel")}
            value={link.label ?? ""}
            onValue={(label) => update(label ? { ...link, label } : { url: link.url })}
            maxLength={30}
          />
        </>
      )}
    />
  );
}

function CodeFields({ block, onChange, err }: { block: Project; onChange: (block: Project) => void; err: (path: string) => string | undefined }) {
  const t = useTranslations("app.portfolio");
  const tFields = useTranslations("app.fields");
  const [refreshing, setRefreshing] = useState(false);
  const source = block.source;
  const code = block.code;
  const setCode = (patch: Partial<NonNullable<Project["code"]>>) => {
    // A first sample starts in the repository's language, when it is one the page knows.
    const start = code ? {} : { lang: codeLangOf(source?.language) };
    const next = { text: code?.text ?? "", ...start, ...code, ...patch };
    const { code: _code, ...rest } = block;
    if (!next.text) {
      onChange(rest);
      return;
    }
    const { lang, file, text } = next;
    onChange({ ...rest, code: { text, ...(lang ? { lang } : {}), ...(file ? { file } : {}) } });
  };
  const refresh = async () => {
    if (!source) return;
    setRefreshing(true);
    const meta = await fetchLinkMetadata(`https://github.com/${source.owner}/${source.repo}`);
    setRefreshing(false);
    if (!meta) return;
    onChange({
      ...block,
      source: {
        ...source,
        ...(meta.stars !== undefined && source.stars !== undefined ? { stars: meta.stars } : {}),
        ...(meta.language ? { language: meta.language.slice(0, 40) } : {}),
        ...(meta.license ? { license: meta.license.slice(0, 40) } : {}),
        readAt: new Date().toISOString().slice(0, 10),
      },
    });
  };
  return (
    <>
      {source ? (
        <div className="grid grid-cols-1 gap-3 rounded-md border border-line bg-surface p-3">
          <p dir="ltr" className="font-mono text-small font-semibold [[dir=rtl]_&]:text-end">
            {source.owner}/{source.repo}
          </p>
          <p dir="ltr" className="text-small text-fg-secondary [[dir=rtl]_&]:text-end">{[source.stars !== undefined ? `★ ${String(source.stars)}` : null, source.language, source.license].filter(Boolean).join(" · ")}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" icon={RefreshCw} loading={refreshing} onClick={() => void refresh()}>
              {t("repoRefresh")}
            </Button>
            {source.stars !== undefined ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={StarOff}
                onClick={() => {
                  const { stars: _stars, ...rest } = source;
                  onChange({ ...block, source: rest });
                }}
              >
                {t("removeStars")}
              </Button>
            ) : null}
          </div>
          <TextInput
            label={tFields("install")}
            ltr
            value={source.install ?? ""}
            onValue={(install) => {
              const { install: _install, ...rest } = source;
              onChange({ ...block, source: install ? { ...rest, install } : rest });
            }}
            maxLength={200}
          />
        </div>
      ) : null}
      <TextArea label={t("codeText")} hint={t("codeHint")} value={code?.text ?? ""} onValue={(text) => setCode({ text })} max={2400} rows={6} mono error={err("code.text")} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField<CodeLang | "none">
          label={t("codeLang")}
          value={code?.lang ?? "none"}
          onValue={(lang) => setCode({ lang: lang === "none" ? undefined : lang })}
          options={[{ value: "none", label: "—" }, ...CODE_LANGS.map((lang) => ({ value: lang, label: lang }))]}
        />
        <TextInput label={t("codeFile")} ltr value={code?.file ?? ""} disabled={!code} onValue={(file) => setCode({ file: file || undefined })} maxLength={80} />
      </div>
    </>
  );
}

/** GitHub's name of a language → the code sample's language, when the sample knows it. */
const LANG_NAMES: Readonly<Record<string, CodeLang>> = {
  typescript: "ts",
  javascript: "js",
  "c#": "csharp",
  "c++": "cpp",
  "objective-c": "cpp",
  shell: "shell",
  bash: "shell",
  scss: "css",
};
export function codeLangOf(language: string | undefined): CodeLang | undefined {
  const name = language?.trim().toLowerCase();
  if (!name) return undefined;
  const known = LANG_NAMES[name];
  if (known) return known;
  return (CODE_LANGS as readonly string[]).includes(name) ? (name as CodeLang) : undefined;
}

/**
 * The project's address, left to right in every language: linkyo.app/<username>/<slug>. The typed
 * address counts when the field is left (or Enter is pressed), so the steps in between never become
 * earlier addresses. A problem shows under the field at once, and the address goes into the draft
 * all the same, so Save refuses it with the same words instead of quietly keeping the old one.
 * Left empty, the address that works comes back (the saved one, else the one the title gives).
 */
function AddressFields({
  block,
  onChange,
  saved,
  username,
  err,
  inline = false,
}: {
  block: Project;
  onChange: (block: Project) => void;
  saved: Project | undefined;
  username: string;
  err: (path: string) => string | undefined;
  /** Shown in the quick form (a title without Latin letters): the field starts empty, the fallback stays. */
  inline?: boolean;
}) {
  const t = useTranslations("app.portfolio");
  const { doc } = useSite();
  const id = useId();
  const shownAs = (slug: string) => (inline && FALLBACK_SLUG.test(slug) ? "" : slug);
  const [text, setText] = useState({ slug: block.slug, value: shownAs(block.slug) });
  if (text.slug !== block.slug) setText({ slug: block.slug, value: shownAs(block.slug) });
  const [problem, setProblem] = useState<string | null>(null);
  const typed = text.value.trim().toLowerCase();
  const previous = formerOwner(typed, block.id, doc.blocks);
  const commit = () => {
    if (!typed) {
      setProblem(null);
      const working = saved?.slug ?? slugFor(block.title, takenAddresses(doc.blocks, block.id), slugWord(doc.profile.locale), block.source?.repo);
      if (working !== block.slug) onChange(changeSlug(block, working, saved));
      else setText({ slug: block.slug, value: shownAs(block.slug) });
      return;
    }
    const why = slugProblem(typed, block.id, doc.blocks);
    setProblem(why ? t(why) : null);
    // `changeSlug` builds `was` from the saved project, so a corrected address later leaves nothing behind.
    if (typed !== block.slug) onChange(changeSlug(block, typed, saved));
  };
  const kept = saved?.slug && block.slug !== saved.slug;
  // What the field should know besides a problem, read with it (its description is a polite live region).
  const notes = [previous ? t("slugTakeover", { title: previous.title }) : null, kept ? t("addressKept") : null, inline ? t("slugLatinHint") : null].filter(
    (note): note is string => note !== null,
  );
  return (
    <div className="grid grid-cols-1 gap-2">
      <TextInput
        id={id}
        label={t("address")}
        hint={problem ? undefined : notes.join(" ") || undefined}
        error={problem ?? err("slug")}
        ltr
        leading={
          <span dir="ltr" className="max-w-1/2 shrink-0 truncate text-small text-fg-secondary">
            linkyo.app/{username}/
          </span>
        }
        placeholder={block.slug || undefined}
        value={text.value}
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        maxLength={48}
        onValue={(value) => {
          setProblem(null);
          setText({ slug: block.slug, value: value.toLowerCase().replace(/\s+/g, "-") });
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          // Enter takes the address; it does not save the sheet yet.
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
      />
    </div>
  );
}
