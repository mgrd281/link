"use client";

import { Button, Icon } from "@linkyo/ui";
import { Check, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Disclosure } from "../disclosure";
import { ListRow } from "../list";
import { ProgressBar } from "../progress-bar";
import { NAV_ANCHORS } from "../routes";
import type { HomeTaskKey } from "./progress";

export type { HomeTaskKey } from "./progress";

/** One step to a finished page; `run` opens the place that completes it. */
export interface HomeTask {
  key: HomeTaskKey;
  icon: LucideIcon;
  done: boolean;
  run: () => void;
}

/** A step as a row: its icon, its title, a chevron. Done steps are ticked and struck through. */
export function TaskRow({ task }: { task: HomeTask }) {
  const t = useTranslations("app.home.checklist");
  return (
    <ListRow
      icon={task.done ? Check : task.icon}
      done={task.done}
      title={
        <>
          {t(`items.${task.key}.title`)}
          {task.done ? <span className="sr-only"> {t("isDone")}</span> : null}
        </>
      }
      onClick={task.run}
    />
  );
}

/**
 * While the page is still being built: the one thing to do now, with the screen's only primary
 * button, then the steps after it as quiet rows, and what is done folded away. The steps keep their
 * order (`tasks` comes in it), so the next one is always the first that is still open.
 */
export function NextStep({ tasks }: { tasks: readonly HomeTask[] }) {
  const t = useTranslations("app.home");
  const open = tasks.filter((task) => !task.done);
  const finished = tasks.filter((task) => task.done);
  const [step, ...later] = open;
  if (!step) return null;
  const progress = t("checklist.progress", { done: finished.length, total: tasks.length });

  return (
    <section aria-labelledby={NAV_ANCHORS.homeNext} className="grid grid-cols-1 gap-4 rounded-lg bg-group p-4 lg:border lg:border-line lg:p-6">
      <div className="flex items-baseline justify-between gap-3">
        {/* A jump target of the section panel: focusable by script, no ring of its own. */}
        <p id={NAV_ANCHORS.homeNext} tabIndex={-1} className="text-caption font-semibold text-fg-secondary outline-none">
          {t("next.eyebrow")}
        </p>
        {/* The bar below says the same to screen readers. */}
        <p aria-hidden className="text-caption tabular-nums text-fg-secondary">
          {progress}
        </p>
      </div>
      <ProgressBar value={finished.length} max={tasks.length} label={t("checklist.title")} valueText={progress} />

      <div className="flex items-start gap-4">
        <span className="grid size-control-lg shrink-0 place-items-center rounded-md bg-tinted text-tinted-fg">
          <Icon icon={step.icon} size="md" />
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 className="text-title rtl:tracking-normal">
            {t(`checklist.items.${step.key}.title`)}
          </h2>
          <p className="text-small font-regular text-fg-secondary">{t(`checklist.items.${step.key}.hint`)}</p>
        </div>
      </div>
      <Button variant="primary" size="lg" icon={step.icon} className="w-full sm:w-auto sm:justify-self-start" onClick={step.run}>
        {t(`next.actions.${step.key}`)}
      </Button>

      {/* The rows run to the card's edges on phones; their icons line up with the content above. */}
      {later.length > 0 ? (
        // Safari (VoiceOver) drops the list semantics of a <ul> without bullets unless the role is set.
        // eslint-disable-next-line jsx-a11y/no-redundant-roles -- see above
        <ul role="list" className="-mx-4 border-t border-line">
          {later.map((task) => (
            <TaskRow key={task.key} task={task} />
          ))}
        </ul>
      ) : null}
      {finished.length > 0 ? (
        // Runs to the card's edges like the rows above (its content clips); the summary lines up with their text.
        <Disclosure summary={t("checklist.showDone", { count: finished.length })} className="-mx-4" triggerClassName="ms-16">
          {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- see above */}
          <ul role="list" className="pt-1">
            {finished.map((task) => (
              <TaskRow key={task.key} task={task} />
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </section>
  );
}
