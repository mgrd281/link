"use client";

import type { CreatorKind } from "@linkyo/blocks";
import { Badge, Icon, Skeleton } from "@linkyo/ui";
import { ArrowRight, AtSign, ChartNoAxesColumn, FolderKanban, Gift, HandHeart, ImagePlus, Palette, Plus, Scale, Send, TextQuote, X, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type CSSProperties } from "react";

import { accountStore } from "@/features/account/store";
import { AiHomeCard } from "@/features/ai/home-card";
import { useAppMode } from "@/features/app-mode/use-app-mode";
import { REFERRAL_RULES } from "@/features/referrals/rules";
import { Link, useRouter } from "@/i18n/navigation";

import { blankBlock } from "./blocks";
import { LinkCard } from "./home/link-card";
import { NextStep, TaskRow, type HomeTask } from "./home/next-step";
import { homeProgress, homeTasks, homeTasksDone, linkHint, type HomeTaskKey } from "./home/progress";
import { ProposalCard } from "./home/proposal-card";
import { HomeIntents } from "./install/home-intents";
import { InstallHint } from "./install/install-hint";
import { ListGroup, ListRow } from "./list";
import { ProfileSheet } from "./profile-sheet-lazy";
import { startedBlock } from "./project-start";
import { INVITE_HREF, NAV_ANCHORS } from "./routes";
import { sampleStats, totals } from "./sample-stats";
import { Panel, Screen } from "./screen";
import { useSite } from "./site-context";
import { statsSource, useLiveStats, type StatsDay } from "./stats";
import { weekdayLong, weekdayName } from "./weekday";

/**
 * Home answers one question: what is my next step to get visitors? While the page is being built,
 * that step is the one primary action. Once the essentials are there, sharing the link is, with the
 * remaining steps as quiet rows. Sample stats appear only then: an empty page has nothing to count.
 * Which steps are offered (a portfolio starts with its work, then the way to reach its owner), which
 * are done, and when the page counts as ready, comes from `home/progress`.
 *
 * On a laptop Home is a dashboard, not a stretched phone: once its column has room for two
 * (`layout.column-wide`), the cards stand in two columns. CSS columns keep the phone's order: reading
 * and focus run down the first column, then the second. While the page is being built the link starts
 * the second column; once it is ready the week's numbers do.
 */
export function HomeScreen() {
  const t = useTranslations("app.home");
  const tApp = useTranslations("appMode.home");
  const app = useAppMode();
  const tInvite = useTranslations("app.invite");
  const tPortfolio = useTranslations("app.portfolio");
  const router = useRouter();
  const { doc, site, account, setAddOpen, edit } = useSite();
  const [profileOpen, setProfileOpen] = useState(false);
  const name = doc.profile.displayName;
  const kind = site.kind as CreatorKind | undefined;

  const isDone = homeTasksDone(doc, site);
  const steps: Record<HomeTaskKey, { icon: LucideIcon; run: () => void; hint?: string }> = {
    // Content first: a page without links has nothing to tap. What "3 things" suggests depends on the kind.
    links: { icon: Plus, run: () => setAddOpen(true), hint: t(`checklist.linkHints.${linkHint(kind)}`) },
    // Work first on a portfolio: the Add sheet offers a project from photos, a link or a blank form.
    projects: { icon: FolderKanban, run: () => setAddOpen(true) },
    contact: {
      icon: Send,
      run: () => {
        // A page has one contact block, and it closes the page: a new one starts with the kind's closing line, at the end.
        const existing = doc.blocks.find((block) => block.type === "contact");
        edit(existing ? { mode: "edit", id: existing.id } : { mode: "create", block: startedBlock(blankBlock("contact", { artist: "", newsletter: "" }), kind, (key) => tPortfolio(key as "sentence")) });
      },
    },
    photo: { icon: ImagePlus, run: () => setProfileOpen(true) },
    bio: { icon: TextQuote, run: () => setProfileOpen(true) },
    socials: {
      icon: AtSign,
      run: () => {
        const existing = doc.blocks.find((block) => block.type === "socials");
        edit(existing ? { mode: "edit", id: existing.id } : { mode: "create", block: blankBlock("socials", { artist: name, newsletter: "" }), index: 0 });
      },
    },
    look: { icon: Palette, run: () => router.push("/app/design") },
    legal: { icon: Scale, run: () => router.push("/app/settings/legal") },
  };
  const tasks: HomeTask[] = homeTasks(site).map((key) => ({ key, done: isDone[key], ...steps[key] }));
  const { ready, complete, done, total } = homeProgress(doc, site);
  const open = tasks.filter((task) => !task.done);

  // While the next-step card is showing, it already says how far along the page is ("2 of 6"): the
  // line under the title would only repeat it, so it is left out until the page is ready.
  const lead = complete ? t("leadComplete") : ready ? t("leadReady") : undefined;

  return (
    <Screen title={t("title", { name })} lead={lead} preview wide>
      {site.prepared && !site.prepared.seen ? (
        // The banner is teal: its focus rings are drawn in the color on teal, or they would not show.
        <section aria-labelledby="prepared-title" className="relative grid gap-3 overflow-hidden rounded-lg bg-primary p-5 text-primary-fg [--color-focus:var(--color-primary-fg)]">
          <div className="flex items-start gap-3">
            <span className="grid size-control-md shrink-0 place-items-center rounded-full bg-primary-fg text-primary">
              <Icon icon={HandHeart} size="md" />
            </span>
            <div className="grid min-w-0 flex-1 gap-1">
              <h2 id="prepared-title" className="text-body-lg font-semibold">
                {t("preparedTitle", { name })}
              </h2>
              <p className="text-small">{t("preparedBody")}</p>
            </div>
            {/* 32 px to look at, 48 px to hit on a touch screen (the spacing scale has no 1.5 step). */}
            <button
              type="button"
              aria-label={t("preparedDismiss")}
              onClick={() => accountStore.updateSite((current) => ({ ...current, prepared: { at: current.prepared?.at ?? new Date().toISOString(), seen: true } }))}
              className="relative grid size-control-sm shrink-0 place-items-center rounded-full before:absolute before:inset-0 hover:bg-hover-inverse focus-visible:focus-ring pointer-coarse:before:-inset-2"
            >
              <Icon icon={X} size="sm" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 ps-12">
            <Link
              href="/app/preview"
              className="inline-flex h-control-md items-center gap-2 rounded-md bg-primary-fg px-4 text-small font-semibold text-primary transition-[scale] duration-micro focus-visible:focus-ring active:scale-pressed motion-reduce:active:scale-none"
            >
              {t("preparedView")}
            </Link>
            <Link
              href="/app/editor"
              className="inline-flex h-control-md items-center gap-2 rounded-md border border-primary-fg px-4 text-small font-semibold transition-[scale] duration-micro focus-visible:focus-ring active:scale-pressed motion-reduce:active:scale-none"
            >
              {t("preparedEdit")}
            </Link>
          </div>
        </section>
      ) : null}

      {/* The Add sheet a shortcut of the installed app or a share asked for (install/intents.ts). */}
      <HomeIntents />
      {/* Where the browser offers to install Linkyo: a hint, once (install/install-hint.tsx). */}
      <InstallHint />
      {/* Real accounts with the page service: a proposal from the team comes first. */}
      <ProposalCard />
      <div className="@container">
        <div className="-mb-6 *:mb-6 *:break-inside-avoid @column-wide:columns-2 @column-wide:gap-6">
      {ready ? null : <AiHomeCard ready={false} />}
      {ready ? null : <NextStep tasks={tasks} />}
      <div className={ready ? undefined : "@column-wide:break-before-column"}>
        <LinkCard username={account.username} ready={ready} />
      </div>
      {ready ? <AiHomeCard ready /> : null}
      {ready && !complete ? (
        <ListGroup
          title={t("open.title")}
          titleId={NAV_ANCHORS.homeTodo}
          trailing={<span className="text-caption tabular-nums text-fg-secondary">{t("checklist.progress", { done, total })}</span>}
        >
          {open.map((task) => (
            <TaskRow key={task.key} task={task} />
          ))}
        </ListGroup>
      ) : null}
      {ready ? (
        <div className="@column-wide:break-before-column">
          <WeekStats />
        </div>
      ) : null}
      {/* Once the page is worth sharing, the invite program (the rail's Invite on wide screens). The
          subtitle names the rewards, never a count: no request, no numbers to load. */}
      {ready ? (
        <ListGroup>
          <ListRow
            icon={Gift}
            title={tInvite("title")}
            // The iPhone app names only the verification: it promises no paid plan (App Store 3.1.3(f)).
            subtitle={app ? tApp("inviteSubtitle", { count: REFERRAL_RULES.verificationAt }) : t("inviteSubtitle", { verify: REFERRAL_RULES.verificationAt, pro: REFERRAL_RULES.proForLifeAt })}
            subtitleWrap
            href={INVITE_HREF}
          />
        </ListGroup>
      ) : null}
        </div>
      </div>

      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </Screen>
  );
}

/**
 * The last seven days at a glance, with the way to the full view. The demo shows labelled sample
 * numbers; a real account its own cookie-free counts once counting is on, and until then that its
 * numbers are coming (no invented numbers, no unmeasured zeros). On a laptop, where Home stands in
 * two columns, the card also names the most tapped blocks and where visitors came from, so the second
 * column carries the week instead of empty space.
 */
function WeekStats() {
  return statsSource() === "sample" ? <SampleWeekStats /> : <LiveWeekStats />;
}

function WeekStatsEmpty() {
  const t = useTranslations("app.home");
  return <WeekNotice title={t("stats.empty.title")} body={t("stats.empty.body")} />;
}

function WeekNotice({ title, body, more = false }: { title: string; body: string; more?: boolean }) {
  const t = useTranslations("app.home");
  return (
    <Panel title={t("stats.title")} id={NAV_ANCHORS.homeWeek}>
      <div className="flex items-start gap-4">
        <span className="grid size-control-lg shrink-0 place-items-center rounded-full bg-selected text-selected-fg">
          <Icon icon={ChartNoAxesColumn} size="md" />
        </span>
        <div className="grid min-w-0 gap-1">
          <p className="text-body font-semibold">{title}</p>
          <p className="text-small font-regular text-fg-secondary">{body}</p>
        </div>
      </div>
      {more ? <MoreLink /> : null}
    </Panel>
  );
}

function MoreLink() {
  const t = useTranslations("app.home");
  return (
    <Link
      href="/app/analytics"
      // A line of text to see, a 44 px tall target on touch screens (the hit area grows 12 px above and below).
      className="relative inline-flex items-center gap-2 justify-self-start rounded-xs text-small font-semibold text-link before:absolute before:inset-x-0 before:-inset-y-3 pointer-fine:before:hidden transition-colors duration-micro hover:text-link-hover focus-visible:focus-ring"
    >
      {t("stats.more")}
      <Icon icon={ArrowRight} size="sm" />
    </Link>
  );
}

function LiveWeekStats() {
  const t = useTranslations("app.home");
  const tStats = useTranslations("app.analytics");
  const { account, doc, label } = useSite();
  const state = useLiveStats(account.id, 7);
  if (state.status === "off") return <WeekStatsEmpty />;
  if (state.status === "error") return <WeekNotice title={t("stats.error.title")} body={t("stats.error.body")} more />;
  if (state.status === "loading")
    return (
      <Panel title={t("stats.title")} id={NAV_ANCHORS.homeWeek}>
        <div aria-busy className="grid gap-4">
          <p role="status" className="sr-only">
            {tStats("loading")}
          </p>
          <Skeleton className="h-control-lg w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Panel>
    );
  const { stats } = state;
  if (stats.since === null) return <WeekNotice title={t("stats.nothingYet.title")} body={t("stats.nothingYet.body")} />;
  const blocks = new Map(doc.blocks.map((block) => [block.id, block]));
  const referred = stats.referrers.reduce((sum, item) => sum + item.count, 0) || 1;
  return (
    <WeekCard
      days={stats.days}
      views={stats.totals.views}
      clicks={stats.totals.clicks}
      links={stats.blocks.map((item) => {
        const block = blocks.get(item.key);
        return { key: item.key, label: block ? label(block) : tStats("removedBlock"), clicks: item.count };
      })}
      sources={stats.referrers.map((item) => ({
        key: item.key,
        label: tStats.has(`sourceNames.${item.key}`) ? tStats(`sourceNames.${item.key}` as "sourceNames.other") : tStats("sourceNames.other"),
        share: item.count / referred,
      }))}
      sample={false}
    />
  );
}

function SampleWeekStats() {
  const t = useTranslations("app.analytics");
  const { doc, account, label } = useSite();
  const stats = useMemo(() => sampleStats(account.username, doc.blocks, 7), [account.username, doc.blocks]);
  const week = totals(stats.days);
  return (
    <WeekCard
      days={stats.days.map((day) => ({ date: day.date, views: day.views, visitors: null, clicks: day.clicks }))}
      views={week.views}
      clicks={week.clicks}
      links={stats.links.map(({ block, clicks }) => ({ key: block.id, label: label(block), clicks }))}
      sources={stats.sources.map((source) => ({ key: source.key, label: t(`sourceNames.${source.key}` as "sourceNames.other"), share: source.share }))}
      sample
    />
  );
}

interface WeekCardProps {
  days: StatsDay[];
  views: number;
  clicks: number;
  links: { key: string; label: string; clicks: number }[];
  sources: { key: string; label: string; share: number }[];
  sample: boolean;
}

function WeekCard({ days, views, clicks, links, sources, sample }: WeekCardProps) {
  const t = useTranslations("app.home");
  const locale = useLocale();
  const max = Math.max(...days.map((day) => day.views ?? 0), 1);
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  const percent = (n: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(n);
  // Under the bars: a short name that tells the days apart (not one letter); for a screen reader: the whole name.
  const weekday = (iso: string) => weekdayName(iso, locale);
  const longDay = (iso: string) => weekdayLong(iso, locale);
  const topLinks = links.filter((link) => link.clicks > 0).slice(0, 3);
  const topSources = sources.slice(0, 3);

  return (
    <Panel title={t("stats.title")} id={NAV_ANCHORS.homeWeek} action={sample ? <Badge size="sm">{t("stats.sample")}</Badge> : undefined}>
      <dl className="grid grid-cols-3">
        {[
          { key: "views", value: number(views) },
          { key: "clicks", value: number(clicks) },
          { key: "ctr", value: percent(views ? clicks / views : 0) },
        ].map((item, index) => (
          <div key={item.key} className={index === 0 ? "grid gap-1" : "grid gap-1 border-s border-line ps-3"}>
            <dt className="text-caption text-fg-secondary">{t(`stats.${item.key}` as "stats.views")}</dt>
            <dd className="text-h3 tabular-nums md:text-h2">{item.value}</dd>
          </div>
        ))}
      </dl>
      <figure className="grid grid-cols-1 gap-2">
        <figcaption className="sr-only">{t("stats.chartLabel")}</figcaption>
        <ol className="grid h-24 grid-cols-7 items-end gap-2">
          {days.map((day) => (
            <li key={day.date} className="grid h-full grid-rows-[1fr_auto] gap-1">
              <span className="flex items-end">
                {day.views === null ? (
                  // Before counting began: no column, and it says so (never a 0).
                  <span role="img" aria-label={t("stats.notCounted", { day: longDay(day.date) })} className="h-1 w-full rounded-sm border border-dashed border-line" />
                ) : (
                  <span
                    className="h-(--h) w-full rounded-sm bg-link"
                    style={{ "--h": `${Math.max(4, (day.views / max) * 100)}%` } as CSSProperties}
                    aria-label={t("stats.dayLabel", { day: longDay(day.date), views: number(day.views) })}
                    role="img"
                  />
                )}
              </span>
              <span aria-hidden className="text-center text-caption text-fg-tertiary">
                {weekday(day.date)}
              </span>
            </li>
          ))}
        </ol>
      </figure>
      {/* Laptops: Home has two columns, and the week fills its own with what it found. */}
      {topLinks.length > 0 || topSources.length > 0 ? (
        <div className="hidden gap-4 border-t border-line pt-4 @column-wide:grid @column-wide:grid-cols-2">
          {topLinks.length > 0 ? <WeekList title={t("stats.topLinks")} items={topLinks.map((link) => ({ key: link.key, label: link.label, value: number(link.clicks) }))} /> : null}
          {topSources.length > 0 ? <WeekList title={t("stats.sources")} items={topSources.map((source) => ({ key: source.key, label: source.label, value: percent(source.share) }))} /> : null}
        </div>
      ) : null}
      <MoreLink />
    </Panel>
  );
}

function WeekList({ title, items }: { title: string; items: { key: string; label: string; value: string }[] }) {
  return (
    // min-w-0 and one shrinkable track: a long block title is cut with an ellipsis inside its own
    // column instead of widening the list (an auto track would size to the longest unbroken title).
    <div className="grid min-w-0 grid-cols-1 content-start gap-2">
      <h3 className="text-caption font-semibold text-fg-secondary">{title}</h3>
      <ol className="grid min-w-0 grid-cols-1 gap-1">
        {items.map((item) => (
          <li key={item.key} className="flex min-w-0 items-baseline justify-between gap-3 text-small">
            <span dir="auto" className="min-w-0 truncate">
              {item.label}
            </span>
            <span className="shrink-0 text-fg-secondary tabular-nums">{item.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
