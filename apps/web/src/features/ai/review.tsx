"use client";

import type { Block, Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";
import { cn, Icon, Segmented } from "@linkyo/ui";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState, type ReactNode, type Ref } from "react";

import { blockIcon } from "@/features/directions/editor/ui";
import { blockSummary, blockTitle } from "@/features/directions/editor/use-editor";
import { platformName } from "@/features/directions/shared/creator-kit";

import { DRAFT_PHONE_HEIGHT, DraftColumns, DraftPhone } from "./draft-phone";
import type { AiRunEvent } from "./events";
import { OtherLooks } from "./other-looks";
import { NotesList, SourceList } from "./timeline";

export interface ReviewDraft {
  page: Page;
  theme: CreatorThemeConfig;
  kind: string | null;
}

/** The draft as it will be used: without the unticked blocks, in the picked look. */
export function editedDraft(draft: ReviewDraft, excluded: ReadonlySet<string>, look: CreatorThemeConfig | null): { page: Page; theme: CreatorThemeConfig } {
  return { page: { ...draft.page, blocks: draft.page.blocks.filter((block) => !excluded.has(block.id)) }, theme: look ?? draft.theme };
}

function BlockRow({ block, checked, onToggle }: { block: Block; checked: boolean; onToggle: () => void }) {
  const t = useTranslations("app.ai.review");
  const tTypes = useTranslations("dashboard.types");
  const title = blockTitle(block, (type) => tTypes(type));
  const summary = blockSummary(block, (platform) => platformName(platform as Parameters<typeof platformName>[0]));
  const type = tTypes(block.type);
  return (
    <li>
      <label className={cn("flex min-h-touch-target cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-micro hover:bg-hover has-[:focus-visible]:focus-ring", !checked && "text-fg-secondary")}>
        <input type="checkbox" checked={checked} onChange={onToggle} aria-label={t("keepBlock", { title })} className="sr-only" />
        {/* The box: drawn, so it follows the palette (filled when kept). */}
        <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-sm border-emphasis", checked ? "border-primary bg-primary text-primary-fg" : "border-line-input bg-surface")}>
          {checked ? <Icon icon={Check} size="sm" /> : null}
        </span>
        <span className="grid size-control-sm shrink-0 place-items-center rounded-md bg-canvas-muted text-fg">
          <Icon icon={blockIcon[block.type]} size="sm" />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          {/* The line keeps the page's direction (an Arabic list stays right-aligned); the bdi only
              isolates the title's own order ("Eventim" on an Arabic page). */}
          <span className="truncate text-body font-medium">
            <bdi>{title}</bdi>
          </span>
          <span className="flex min-w-0 gap-2 text-small text-fg-secondary">
            {type !== title ? <span className="shrink-0">{type}</span> : null}
            {summary ? (
              <span dir="auto" className="truncate">
                {summary}
              </span>
            ) : null}
          </span>
        </span>
      </label>
    </li>
  );
}

/**
 * Review a draft before it goes on the page: why it looks like this, its blocks (one checkbox each;
 * this list is also the words for what the phone shows), other looks made without the AI, what was
 * read, and the actions in a bar at the bottom. With `before`, a Before | Draft switch shows the
 * current page in the phone. Used for AI drafts (`kind: "ai"`) and for the team's proposals
 * (`kind: "proposal"`); `onChange` hands the host the draft as it will be used.
 */
export function DraftReview({
  kind,
  draft,
  before,
  notes,
  sources,
  summary,
  chip,
  actions,
  aside,
  above,
  below,
  onChange,
  headingRef,
}: {
  kind: "ai" | "proposal";
  draft: ReviewDraft;
  before: { page: Page; theme: CreatorThemeConfig } | null;
  notes?: { topic: "look" | "order" | "copy" | "missing"; text: string }[] | undefined;
  sources?: Extract<AiRunEvent, { type: "source" }>[] | undefined;
  summary?: ReactNode;
  chip: ReactNode;
  /** The buttons of the sticky bar at the bottom of the column. */
  actions: ReactNode;
  aside?: ReactNode;
  /** Right above the bar, scrolling with the page (a hint such as "This replaces your current page"). */
  above?: ReactNode;
  /** Under the bar, quiet, at the end of the column (the page service line). */
  below?: ReactNode;
  onChange?: ((draft: { page: Page; theme: CreatorThemeConfig }) => void) | undefined;
  /** The heading ("Your draft"): focus moves there when a run ends while focus is still on Stop. */
  headingRef?: Ref<HTMLHeadingElement> | undefined;
}) {
  const t = useTranslations("app.ai.review");
  const tAi = useTranslations("ai.run");
  const tProposal = useTranslations("app.proposals");
  const headingId = useId();
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set());
  const [look, setLook] = useState<CreatorThemeConfig | null>(null);
  const [view, setView] = useState<"after" | "before">("after");
  const edited = useMemo(() => editedDraft(draft, excluded, look), [draft, excluded, look]);
  const rtl = draft.page.profile.locale === "ar";

  const change = (nextExcluded: ReadonlySet<string>, nextLook: CreatorThemeConfig | null) => {
    setExcluded(nextExcluded);
    setLook(nextLook);
    onChange?.(editedDraft(draft, nextExcluded, nextLook));
  };
  const toggle = (id: string) => {
    const next = new Set(excluded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    change(next, look);
  };

  const shown = view === "before" && before ? before : edited;
  const phone = (
    <>
      {chip}
      {before ? (
        <Segmented
          label={t("compare")}
          size="sm"
          value={view}
          onValueChange={setView}
          options={[
            { value: "before", label: t("before") },
            { value: "after", label: t("after") },
          ]}
        />
      ) : null}
      <DraftPhone page={shown.page} theme={shown.theme} label={tAi("phone")} busy={false} className={DRAFT_PHONE_HEIGHT.review} />
    </>
  );

  return (
    <DraftColumns phone={phone} top="review" className="pb-0">
      <section aria-labelledby={headingId} className="grid grid-cols-1 gap-2">
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-h2 tracking-tight outline-none rtl:tracking-normal">
          {kind === "ai" ? t("title") : tProposal("title")}
        </h2>
        {summary ? <div className="grid grid-cols-1 gap-1 text-small text-fg-secondary">{summary}</div> : null}
      </section>

      {notes && notes.length > 0 ? (
        <section className="grid grid-cols-1 gap-3">
          <h3 className="text-title rtl:tracking-normal">{t("notes")}</h3>
          <div className="rounded-lg border border-line bg-surface p-4">
            <NotesList notes={notes} />
          </div>
        </section>
      ) : null}

      <fieldset className="grid min-w-0 grid-cols-1 gap-3">
        <legend className="mb-1 grid gap-0.5">
          <span className="text-title rtl:tracking-normal">{t("blocks")}</span>
          <span className="text-small text-fg-secondary">{t("blocksHint")}</span>
        </legend>
        <ul className="grid divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {draft.page.blocks.map((block) => (
            <BlockRow key={block.id} block={block} checked={!excluded.has(block.id)} onToggle={() => toggle(block.id)} />
          ))}
        </ul>
      </fieldset>

      <OtherLooks draft={draft.theme} value={look} onChange={(next) => change(excluded, next)} rtl={rtl} />

      {sources && sources.length > 0 ? (
        <section className="grid grid-cols-1 gap-3">
          <h3 className="text-title rtl:tracking-normal">{t("read")}</h3>
          <SourceList sources={sources} />
        </section>
      ) : null}

      {aside}

      {above}
      {/* The actions stay at hand at the bottom of the column, on its solid ground. */}
      <div data-review-actions className="sticky bottom-0 layer-sticky -mx-4 -mt-3 border-t border-line bg-canvas px-4 pt-3 pb-[max(var(--spacing-3),env(safe-area-inset-bottom))] md:-mx-8 md:px-8 lg:mx-0 lg:px-0">
        {actions}
      </div>
      {below ? <div className="-mt-3 pb-8">{below}</div> : <div aria-hidden className="pb-4" />}
    </DraftColumns>
  );
}
