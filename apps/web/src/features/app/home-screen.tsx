"use client";

import { hasImage } from "@linkyo/blocks";
import { Badge, Button, cn, Icon } from "@linkyo/ui";
import { ArrowRight, AtSign, Check, ExternalLink, FileText, ImagePlus, LayoutList, Palette, PartyPopper, Plus, Scale, Sparkles, TextQuote, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type CSSProperties } from "react";

import { accountStore } from "@/features/account/store";
import { Link, useRouter } from "@/i18n/navigation";

import { blankBlock } from "./blocks";
import { ProfileSheet } from "./profile-form";
import { sampleStats, totals } from "./sample-stats";
import { Panel, Screen } from "./screen";
import { QrButton, ShareButtons } from "./share-tools";
import { useSite } from "./site-context";

/**
 * Home: where your page lives, what is left to make it great, and how it is doing.
 * Every checklist item is one tap away from the place that completes it.
 */
export function HomeScreen() {
  const t = useTranslations("app.home");
  const locale = useLocale();
  const router = useRouter();
  const { doc, site, account, setAddOpen, edit } = useSite();
  const [profileOpen, setProfileOpen] = useState(false);
  const name = doc.profile.displayName;

  const contentBlocks = doc.blocks.filter((block) => block.type !== "header" && block.type !== "divider");
  const tasks = [
    { key: "photo", icon: ImagePlus, done: hasImage(doc.profile.avatar) || hasImage(doc.profile.hero), run: () => setProfileOpen(true) },
    { key: "bio", icon: TextQuote, done: doc.profile.bio.trim().length > 0, run: () => setProfileOpen(true) },
    { key: "links", icon: Plus, done: contentBlocks.length >= 3, run: () => setAddOpen(true) },
    {
      key: "socials",
      icon: AtSign,
      done: doc.blocks.some((block) => block.type === "socials" && block.items.some((item) => item.url)),
      run: () => {
        const existing = doc.blocks.find((block) => block.type === "socials");
        edit(existing ? { mode: "edit", id: existing.id } : { mode: "create", block: blankBlock("socials", { artist: name, newsletter: "" }), index: 0 });
      },
    },
    { key: "look", icon: Palette, done: Object.keys(doc.theme).some((key) => key !== "template") || doc.theme.template !== "nocturne", run: () => router.push("/app/design") },
    { key: "legal", icon: Scale, done: !!(site.legal.name && site.legal.address), run: () => router.push("/app/settings#legal") },
  ] as const;
  const done = tasks.filter((task) => task.done).length;

  const stats = useMemo(() => sampleStats(account.username, doc.blocks, 7), [account.username, doc.blocks]);
  const week = totals(stats.days);
  const max = Math.max(...stats.days.map((day) => day.views), 1);
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  const weekday = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(new Date(iso));

  return (
    <Screen title={t("title", { name })} lead={t("lead")} preview>
      {site.prepared && !site.prepared.seen ? (
        <section aria-labelledby="prepared-title" className="relative grid gap-3 overflow-hidden rounded-xl bg-primary p-5 text-primary-fg shadow-e2">
          <div className="flex items-start gap-3">
            <span className="grid size-control-md shrink-0 place-items-center rounded-full bg-primary-fg text-primary">
              <Icon icon={Sparkles} size="md" />
            </span>
            <div className="grid min-w-0 flex-1 gap-1">
              <h2 id="prepared-title" className="text-body-lg font-semibold">
                {t("preparedTitle", { name })}
              </h2>
              <p className="text-small">{t("preparedBody")}</p>
            </div>
            <button
              type="button"
              aria-label={t("preparedDismiss")}
              onClick={() => accountStore.updateSite((current) => ({ ...current, prepared: { at: current.prepared?.at ?? new Date().toISOString(), seen: true } }))}
              className="grid size-control-sm shrink-0 place-items-center rounded-full hover:bg-hover-inverse focus-visible:focus-ring"
            >
              <Icon icon={X} size="sm" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 ps-12">
            <Link href="/app/preview" className="inline-flex h-control-md items-center gap-2 rounded-md bg-primary-fg px-4 text-small font-semibold text-primary focus-visible:focus-ring">
              {t("preparedView")}
            </Link>
            <Link href="/app/editor" className="inline-flex h-control-md items-center gap-2 rounded-md border border-primary-fg px-4 text-small font-semibold focus-visible:focus-ring">
              {t("preparedEdit")}
            </Link>
          </div>
        </section>
      ) : null}
      <Panel className="bg-surface">
        <div className="grid grid-cols-1 gap-1">
          <p className="text-small font-medium text-fg-secondary">{t("yourLink")}</p>
          <p dir="ltr" className="truncate text-start text-h3 font-semibold">
            linkyo.app/<span className="text-link">{account.username}</span>
          </p>
          <p className="text-caption text-fg-tertiary">{t("linkDemo")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ShareButtons username={account.username} compact />
          <QrButton username={account.username} compact />
          <Button asChild icon={ExternalLink} size="md" variant="ghost">
            <Link href="/app/preview">{t("view")}</Link>
          </Button>
        </div>
      </Panel>

      <Panel
        title={done === tasks.length ? t("checklist.doneTitle") : t("checklist.title")}
        id="checklist-title"
        action={
          <span className="text-small font-medium text-fg-secondary">
            {t("checklist.progress", { done, total: tasks.length })}
          </span>
        }
      >
        <div
          role="progressbar"
          aria-labelledby="checklist-title"
          aria-valuemin={0}
          aria-valuemax={tasks.length}
          aria-valuenow={done}
          className="h-2 overflow-hidden rounded-full bg-canvas-muted"
        >
          <div className="h-full w-(--w) rounded-full bg-success transition-[width] duration-standard ease-standard" style={{ "--w": `${(done / tasks.length) * 100}%` } as CSSProperties} />
        </div>
        {done === tasks.length ? (
          <p className="flex items-center gap-3 text-body">
            <Icon icon={PartyPopper} size="md" className="text-link" />
            {t("checklist.doneBody")}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-1">
            {tasks.map((task) => (
              <li key={task.key}>
                <button
                  type="button"
                  onClick={task.run}
                  className="flex w-full items-center gap-3 rounded-md p-2 text-start transition-colors duration-micro hover:bg-hover focus-visible:focus-ring"
                >
                  <span className={cn("grid size-control-sm shrink-0 place-items-center rounded-full", task.done ? "bg-success-subtle text-success-strong" : "bg-canvas-muted text-fg-secondary")}>
                    <Icon icon={task.done ? Check : task.icon} size="sm" />
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className={cn("text-body font-medium", task.done && "text-fg-secondary line-through")}>{t(`checklist.items.${task.key}.title`)}</span>
                    {task.done ? null : <span className="text-small text-fg-secondary">{t(`checklist.items.${task.key}.hint`)}</span>}
                  </span>
                  <span className="sr-only">{task.done ? t("checklist.isDone") : t("checklist.isOpen")}</span>
                  {task.done ? null : <Icon icon={ArrowRight} size="sm" className="shrink-0 text-fg-tertiary rtl:-scale-x-100" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title={t("stats.title")}
        id="stats-title"
        action={
          <Badge tone="warning" size="sm">
            {t("stats.sample")}
          </Badge>
        }
      >
        <dl className="grid grid-cols-3 gap-3">
          {[
            { key: "views", value: number(week.views) },
            { key: "clicks", value: number(week.clicks) },
            { key: "ctr", value: new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(week.ctr) },
          ].map((item) => (
            <div key={item.key} className="grid grid-cols-1 gap-1 rounded-lg bg-canvas-muted p-3">
              <dt className="text-caption text-fg-secondary">{t(`stats.${item.key}`)}</dt>
              <dd className="text-h3 font-semibold tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
        <figure className="grid grid-cols-1 gap-2">
          <figcaption className="sr-only">{t("stats.chartLabel")}</figcaption>
          <ol className="grid h-24 grid-cols-7 items-end gap-2">
            {stats.days.map((day) => (
              <li key={day.date} className="grid h-full grid-rows-[1fr_auto] gap-1">
                <span className="flex items-end">
                  <span
                    className="h-(--h) w-full rounded-sm bg-primary"
                    style={{ "--h": `${Math.max(4, (day.views / max) * 100)}%` } as CSSProperties}
                    aria-label={t("stats.dayLabel", { day: weekday(day.date), views: number(day.views) })}
                    role="img"
                  />
                </span>
                <span aria-hidden className="text-center text-caption text-fg-tertiary">
                  {weekday(day.date)}
                </span>
              </li>
            ))}
          </ol>
        </figure>
        <Link href="/app/analytics" className="inline-flex items-center gap-2 justify-self-start rounded-xs text-small font-semibold text-link underline-offset-4 hover:underline focus-visible:focus-ring">
          {t("stats.more")}
          <Icon icon={ArrowRight} size="sm" className="rtl:-scale-x-100" />
        </Link>
      </Panel>

      <nav aria-label={t("quick.label")} className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { key: "add", icon: Plus, onClick: () => setAddOpen(true) },
          { key: "page", icon: LayoutList, href: "/app/editor" },
          { key: "design", icon: Palette, href: "/app/design" },
          { key: "settings", icon: FileText, href: "/app/settings" },
        ].map((item) => {
          const inner = (
            <>
              <span className="grid size-control-md place-items-center rounded-md bg-selected text-selected-fg">
                <Icon icon={item.icon} size="md" />
              </span>
              <span className="text-small font-semibold">{t(`quick.${item.key}`)}</span>
            </>
          );
          const className =
            "grid content-start gap-3 rounded-xl border border-line bg-surface p-4 text-start shadow-e1 transition-colors duration-micro hover:border-line-input focus-visible:focus-ring active:scale-pressed";
          return item.href ? (
            <Link key={item.key} href={item.href} className={className}>
              {inner}
            </Link>
          ) : (
            <button key={item.key} type="button" onClick={item.onClick} className={className}>
              {inner}
            </button>
          );
        })}
      </nav>
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </Screen>
  );
}
