"use client";

import type { CreatorKind } from "@linkyo/blocks";
import { Badge, Icon } from "@linkyo/ui";
import { ArrowRight, AtSign, ChartNoAxesColumn, FolderKanban, Gift, HandHeart, ImagePlus, Palette, Plus, Scale, Send, TextQuote, X, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type CSSProperties } from "react";

import { accountStore } from "@/features/account/store";
import { AiHomeCard } from "@/features/ai/home-card";
import { REFERRAL_RULES } from "@/features/referrals/rules";
import { Link, useRouter } from "@/i18n/navigation";

import { blankBlock } from "./blocks";
import { LinkCard } from "./home/link-card";
import { NextStep, TaskRow, type HomeTask } from "./home/next-step";
import { homeProgress, homeTasks, homeTasksDone, linkHint, type HomeTaskKey } from "./home/progress";
import { ProposalCard } from "./home/proposal-card";
import { ListGroup, ListRow } from "./list";
import { ProfileSheet } from "./profile-form";
import { startedBlock } from "./project-form";
import { INVITE_HREF, NAV_ANCHORS } from "./routes";
import { sampleStats, totals } from "./sample-stats";
import { Panel, Screen } from "./screen";
import { useSite } from "./site-context";
import { statsSource } from "./stats";

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
            subtitle={t("inviteSubtitle", { verify: REFERRAL_RULES.verificationAt, pro: REFERRAL_RULES.proForLifeAt })}
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
 * numbers; real accounts are not counted yet, so they see that, and no invented numbers.
 */
function WeekStats() {
  return statsSource() === "sample" ? <SampleWeekStats /> : <WeekStatsEmpty />;
}

function WeekStatsEmpty() {
  const t = useTranslations("app.home");
  return (
    <Panel title={t("stats.title")} id={NAV_ANCHORS.homeWeek}>
      <div className="flex items-start gap-4">
        <span className="grid size-control-lg shrink-0 place-items-center rounded-full bg-selected text-selected-fg">
          <Icon icon={ChartNoAxesColumn} size="md" />
        </span>
        <div className="grid min-w-0 gap-1">
          <p className="text-body font-semibold">{t("stats.empty.title")}</p>
          <p className="text-small font-regular text-fg-secondary">{t("stats.empty.body")}</p>
        </div>
      </div>
    </Panel>
  );
}

function SampleWeekStats() {
  const t = useTranslations("app.home");
  const locale = useLocale();
  const { doc, account } = useSite();
  const stats = useMemo(() => sampleStats(account.username, doc.blocks, 7), [account.username, doc.blocks]);
  const week = totals(stats.days);
  const max = Math.max(...stats.days.map((day) => day.views), 1);
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  const weekday = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(new Date(iso));

  return (
    <Panel title={t("stats.title")} id={NAV_ANCHORS.homeWeek} action={<Badge size="sm">{t("stats.sample")}</Badge>}>
      <dl className="grid grid-cols-3">
        {[
          { key: "views", value: number(week.views) },
          { key: "clicks", value: number(week.clicks) },
          { key: "ctr", value: new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(week.ctr) },
        ].map((item, index) => (
          <div key={item.key} className={index === 0 ? "grid gap-1" : "grid gap-1 border-s border-line ps-3"}>
            <dt className="text-caption text-fg-secondary">{t(`stats.${item.key}`)}</dt>
            <dd className="text-h3 tabular-nums md:text-h2">{item.value}</dd>
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
                  className="h-(--h) w-full rounded-sm bg-link"
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
      <Link
        href="/app/analytics"
        className="inline-flex items-center gap-2 justify-self-start rounded-xs text-small font-semibold text-link transition-colors duration-micro hover:text-link-hover focus-visible:focus-ring"
      >
        {t("stats.more")}
        <Icon icon={ArrowRight} size="sm" />
      </Link>
    </Panel>
  );
}
