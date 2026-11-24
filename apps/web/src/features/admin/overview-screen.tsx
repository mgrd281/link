"use client";

import { Avatar, Button, Icon, icons, KpiTile, Segmented, type KpiDelta } from "@linkyo/ui";
import { ArrowRight, CalendarClock, CircleCheck, FilePen, Plus, Rocket, UserX, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";

import { Panel, Screen } from "@/features/app/screen";
import { Link } from "@/i18n/navigation";
import { paymentsEnabled } from "@/lib/flags";
import { supabaseEnabled } from "@/lib/supabase/config";

import { ActivityList } from "./activity-screen";
import { bdi, isolate } from "./bidi";
import { ColumnChart, RankedBars } from "./charts";
import { useCustomers } from "./customers/data";
import { daysAgo, riskFlags } from "./customers/model";
import { kpis, lastDevice, mrrByMonth, REST, shares, signupsPerDay } from "./customers/stats";
import { kpiTrends, revenueThisMonth } from "./customers/trends";
import { DemoNote, FiguresWithheld, PlanBadge, StatusBadges } from "./customers/ui";
import { useCreatorRows, usePublished } from "./data";
import { count, country, money, percent, signed, signedMoney, signedPoints, timeAgo } from "./format";
import { useOrderMoney } from "./orders/money";
import { countOf, dueOrders, useQueues, waitingContract } from "./queues";
import { useAdmin } from "./session";

const RANGES = ["7", "30", "90"] as const;
/** Trials that end within this many days are listed under "Needs a look". */
const TRIAL_DAYS = 3;
/** Orders due within this many hours are listed under "Needs a look". */
const DUE_HOURS = 24;

function Attention({
  icon,
  label,
  value,
  href,
  tone,
}: {
  icon: LucideIcon;
  label: ReactNode;
  /** A count, or "–" for a queue that could not be loaded (never a 0 that says nothing waits). */
  value: number | string;
  href: string;
  tone: "danger" | "warning" | "neutral";
}) {
  return (
    <li>
      <Link href={href} className="flex min-h-touch-target items-center gap-3 rounded-md px-2 py-2 transition-colors duration-micro hover:bg-hover focus-visible:focus-ring">
        <span
          className={
            tone === "danger"
              ? "grid size-control-sm shrink-0 place-items-center rounded-md bg-danger-subtle text-danger-strong"
              : tone === "warning"
                ? "grid size-control-sm shrink-0 place-items-center rounded-md bg-warning-subtle text-warning-strong"
                : "grid size-control-sm shrink-0 place-items-center rounded-md bg-canvas-muted text-fg-secondary"
          }
        >
          <Icon icon={icon} size="sm" />
        </span>
        <span className="min-w-0 flex-1 text-small">{label}</span>
        <span className="text-body font-semibold tabular-nums">{value}</span>
        <Icon icon={ArrowRight} size="sm" className="text-fg-tertiary" />
      </Link>
    </li>
  );
}

/** The whole business at a glance: customers, revenue, growth, where people are, what needs a look. */
export function OverviewScreen() {
  const t = useTranslations("admin.overview");
  const tc = useTranslations("admin.customers");
  const ts = useTranslations("admin.security");
  const ui = useTranslations("ui");
  const locale = useLocale();
  const { db, me, can, role } = useAdmin();
  const { customers, now, ready, blockedIps, withheld, viewsMeasured } = useCustomers();
  const queues = useQueues();
  const [rangeKey, setRange] = useState<(typeof RANGES)[number]>("30");
  const range = Number(rangeKey);
  const published = usePublished(db.token);
  const rows = useCreatorRows(db, published);
  // Page-service orders as money: only where they can exist (real accounts with payments).
  const orderMoney = useOrderMoney(paymentsEnabled && supabaseEnabled && can("orders.view") && can("billing.view"), now);

  const numbers = useMemo(() => kpis(customers, now, range), [customers, now, range]);
  const trends = useMemo(() => kpiTrends(customers, now, range), [customers, now, range]);
  const revenue = useMemo(() => revenueThisMonth(customers, orderMoney.status === "ready" ? orderMoney.data : [], now), [customers, orderMoney, now]);
  const signups = useMemo(() => signupsPerDay(customers, now, range), [customers, now, range]);
  const mrrMonths = useMemo(() => mrrByMonth(customers, now, 6), [customers, now]);
  const countries = useMemo(
    () =>
      shares(
        customers.map((customer) => customer.country || "unknown"),
        6,
      ),
    [customers],
  );
  const devices = useMemo(() => shares(customers.flatMap((customer) => lastDevice(customer)?.type ?? [])), [customers]);
  const blocked = useMemo(() => new Set(blockedIps.map((entry) => entry.ip)), [blockedIps]);
  const risky = useMemo(
    () => customers.filter((customer) => customer.logins.some((login) => daysAgo(now, login.at) <= 1 && riskFlags(login, customer.logins, blocked).length > 0)).length,
    [customers, now, blocked],
  );
  const trialsEnding = customers.filter(
    (customer) => customer.subscription.status === "trialing" && customer.subscription.trialEndsAt && daysAgo(now, customer.subscription.trialEndsAt) >= -TRIAL_DAYS,
  ).length;
  const newest = customers
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const pagesCount = (status: "draft" | "ready" | "published") => rows.filter((row) => row.status === status).length;
  // Not listed (an error): a dash, never a 0 that reads like a count.
  const live = published.status === "ready" ? count(published.pages.length, locale) : published.status === "error" ? "–" : "…";
  const unknown = tc("unknownCountry");

  /** The chip of a KPI tile: an arrow, the signed change and the direction in words (never colour alone). */
  const delta = (change: number, text: string, context: string, good: KpiDelta["good"] = "up"): KpiDelta => ({
    change,
    text,
    label: ui(change > 0 ? "kpi.up" : change < 0 ? "kpi.down" : "kpi.flat"),
    context,
    good,
  });
  const vsStart = t("kpi.vsStart", { days: range });
  const vsPrevious = t("kpi.vsPrevious", { days: range });
  const trendLabel = t("kpi.trend", { days: range });
  const revenueFooter =
    orderMoney.status === "off"
      ? t.markup("kpi.revenueSubscriptions", { bdi: isolate })
      : orderMoney.status === "ready"
        ? t.markup("kpi.revenueHint", { bdi: isolate })
        : orderMoney.status === "loading"
          ? t("kpi.revenueOrdersLoading")
          : t.markup("kpi.revenueOrdersFailed", { bdi: isolate });

  // What waits for the team (A-17): queues that do not exist here (no payments, no permission) stay out.
  const contracts = countOf(queues.contracts, (list) => list.filter(waitingContract).length);
  const due = countOf(queues.orders, (list) => dueOrders(list, new Date(now)).length);
  const verifications = countOf(queues.referrals, (data) => data.verifications);
  const queueValue = (status: string, value: number | null) => (status === "failed" ? "–" : status === "loading" ? "…" : (value ?? 0));

  // Prepared pages and the team's latest work: needs no customer data, so it shows for every role.
  const teamWork = (
    <Panel
      title={t("teamWork")}
      id="team-work-title"
      action={
        <Link href="/admin/activity" className="inline-flex min-h-touch-target items-center gap-1 rounded-sm text-small font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring">
          {t("allActivity")}
          <Icon icon={ArrowRight} size="sm" />
        </Link>
      }
    >
      <dl className="grid grid-cols-3 gap-2">
        {(
          [
            ["published", Rocket, live],
            ["ready", CircleCheck, pagesCount("ready")],
            ["drafts", FilePen, pagesCount("draft")],
          ] as const
        ).map(([key, icon, value]) => (
          <div key={key} className="grid gap-1 rounded-md bg-canvas-muted p-3">
            <dt className="flex items-center gap-1 text-caption text-fg-secondary">
              <Icon icon={icon} size="sm" />
              {t(key)}
            </dt>
            <dd className="text-h3 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {db.activity.length > 0 ? <ActivityList events={db.activity.slice(0, 4)} now={now} /> : <p className="text-small text-fg-secondary">{t("noActivity")}</p>}
    </Panel>
  );

  // The greeting isolates the name, so a Latin name keeps its own direction in Arabic (A-23).
  const firstName = me.name.split(" ")[0] ?? me.name;

  return (
    <Screen
      title={t("title", { name: isolate(firstName) })}
      lead={t("lead")}
      wide
      actions={
        can("pages.create") ? (
          <Button asChild variant="primary" icon={Plus}>
            <Link href="/admin/creators">{t("newPage")}</Link>
          </Button>
        ) : null
      }
    >
      {ready && withheld(role) ? (
        <>
          <FiguresWithheld />
          {teamWork}
        </>
      ) : null}
      {ready && !withheld(role) ? (
        <>
          <Segmented
            label={t("range")}
            value={rangeKey}
            onValueChange={setRange}
            className="justify-self-start"
            options={RANGES.map((days) => ({ value: days, label: t("days", { days: Number(days) }) }))}
          />
          {/* Nine tiles in three rows on a laptop (four without the money); two per row on a phone. */}
          <dl data-kpis className={can("billing.view") ? "grid grid-cols-2 gap-3 lg:grid-cols-3" : "grid grid-cols-2 gap-3 lg:grid-cols-4"}>
            <KpiTile
              label={t("kpi.customers")}
              value={count(trends.customers.value, locale)}
              delta={delta(trends.customers.change, signed(trends.customers.change, locale), vsStart)}
              trend={trends.customers.series}
              trendLabel={trendLabel}
              footer={t("kpi.customersHint", { active: count(numbers.active7, locale) })}
            />
            <KpiTile
              label={t("kpi.new", { days: range })}
              value={count(trends.newCustomers.value, locale)}
              delta={delta(trends.newCustomers.change, signed(trends.newCustomers.change, locale), vsPrevious)}
              trend={trends.newCustomers.series}
              trendLabel={trendLabel}
              footer={t("kpi.newHint", { perDay: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(trends.newCustomers.value / range) })}
            />
            {can("billing.view") ? (
              <>
                <KpiTile
                  label={t("kpi.revenue")}
                  value={money(revenue.value, locale)}
                  delta={delta(revenue.change, signedMoney(revenue.change, locale), t("kpi.vsLastMonth"))}
                  trend={revenue.series}
                  trendLabel={t("kpi.trendMonths", { months: revenue.series.length })}
                  footer={<span data-revenue-orders={orderMoney.status}>{revenueFooter}</span>}
                />
                <KpiTile
                  label={t.markup("kpi.mrrShort", { bdi: isolate })}
                  value={money(trends.mrr.value, locale)}
                  delta={delta(trends.mrr.change, signedMoney(trends.mrr.change, locale), vsStart)}
                  trend={trends.mrr.series}
                  trendLabel={trendLabel}
                  footer={t("kpi.mrrHint", { arr: money(trends.mrr.value * 12, locale) })}
                />
                <KpiTile
                  label={t("kpi.paying")}
                  value={count(trends.paying.value, locale)}
                  delta={delta(trends.paying.change, signed(trends.paying.change, locale), vsStart)}
                  trend={trends.paying.series}
                  trendLabel={trendLabel}
                  footer={t("kpi.payingHint", { trialing: numbers.trialing })}
                />
                <KpiTile
                  label={t.markup("kpi.conversion", { bdi: isolate })}
                  value={percent(trends.conversion.value, locale)}
                  delta={delta(trends.conversion.change, t("kpi.points", { value: signedPoints(trends.conversion.change, locale) }), vsStart)}
                  trend={trends.conversion.series}
                  trendLabel={trendLabel}
                  footer={t.rich("kpi.conversionHint", { bdi })}
                />
                <KpiTile
                  label={t("kpi.churn", { days: range })}
                  value={percent(trends.churn.value, locale)}
                  // Fewer cancellations are the good news here.
                  delta={delta(trends.churn.change, t("kpi.points", { value: signedPoints(trends.churn.change, locale) }), vsPrevious, "down")}
                  footer={t("kpi.churnHint")}
                />
              </>
            ) : null}
            {/* Only the last sign-in is on record, so last week's "active" cannot be known: no trend, rather than a made-up one. */}
            <KpiTile
              label={t("kpi.active")}
              value={count(numbers.active7, locale)}
              footer={t("kpi.activeHint", { share: percent(numbers.customers ? numbers.active7 / numbers.customers : 0, locale) })}
            />
            {/* Real accounts have no view counter yet: "not measured", never a made-up 0. */}
            <KpiTile
              label={t("kpi.views")}
              value={viewsMeasured ? count(numbers.views, locale) : "–"}
              footer={viewsMeasured ? t("kpi.viewsHint", { days: 30 }) : t("kpi.viewsNotMeasured")}
            />
          </dl>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel title={t("attention")} id="attention-title" className="lg:col-span-1">
              <ul data-needs-look className="grid grid-cols-1 gap-1">
                {queues.contracts.status !== "off" ? (
                  <Attention
                    icon={icons.undo}
                    label={t("contractsWaiting")}
                    value={queueValue(queues.contracts.status, contracts)}
                    href="/admin/orders?tab=contracts"
                    tone={contracts ? "danger" : "neutral"}
                  />
                ) : null}
                {queues.orders.status !== "off" ? (
                  <Attention
                    icon={icons.orders}
                    label={t("ordersDue", { hours: DUE_HOURS })}
                    value={queueValue(queues.orders.status, due)}
                    href="/admin/orders"
                    tone={due ? "warning" : "neutral"}
                  />
                ) : null}
                {queues.referrals.status !== "off" ? (
                  <Attention
                    icon={icons.verified}
                    label={t("verificationsWaiting")}
                    value={queueValue(queues.referrals.status, verifications)}
                    href="/admin/referrals"
                    tone={verifications ? "warning" : "neutral"}
                  />
                ) : null}
                {can("billing.view") ? (
                  <Attention icon={icons.warning} label={t("pastDue")} value={numbers.pastDue} href="/admin/subscriptions?status=past_due" tone={numbers.pastDue ? "danger" : "neutral"} />
                ) : null}
                {can("security.view") ? (
                  <Attention icon={icons.security} label={t("risky")} value={risky} href="/admin/security?filter=risky" tone={risky ? "warning" : "neutral"} />
                ) : null}
                {can("billing.view") ? (
                  <Attention
                    icon={CalendarClock}
                    label={t("trialsEnding", { days: TRIAL_DAYS })}
                    value={trialsEnding}
                    href="/admin/subscriptions?status=trialing"
                    tone={trialsEnding ? "warning" : "neutral"}
                  />
                ) : null}
                {can("customers.view") ? <Attention icon={UserX} label={t("suspended")} value={numbers.suspended} href="/admin/customers?status=suspended" tone="neutral" /> : null}
              </ul>
            </Panel>
            <Panel title={t("signupsTitle")} id="signups-title" className="lg:col-span-2">
              <ColumnChart points={signups} label={t("signupsTitle")} format={(value) => count(value, locale)} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            {can("billing.view") ? (
              <Panel title={t("mrrTitle")} id="mrr-title" className="lg:col-span-2">
                <ColumnChart points={mrrMonths} label={t("mrrTitle")} format={(value) => money(value, locale)} dateStyle="month" />
              </Panel>
            ) : null}
            <Panel title={t("countries")} id="countries-title">
              <RankedBars
                label={t("countries")}
                items={countries.map((share) => ({
                  key: share.key,
                  label: share.key === REST ? t("rest") : country(share.key === "unknown" ? "" : share.key, locale, unknown),
                  value: share.value,
                }))}
                format={(value) => count(value, locale)}
              />
            </Panel>
            <Panel title={t("devices")} id="devices-title">
              <RankedBars
                label={t("devices")}
                items={devices.map((share) => ({
                  key: share.key,
                  label: ts(`devices.${share.key as "mobile" | "tablet" | "desktop"}`),
                  value: share.value,
                }))}
                format={(value) =>
                  percent(
                    value /
                      Math.max(
                        1,
                        devices.reduce((sum, share) => sum + share.value, 0),
                      ),
                    locale,
                  )
                }
              />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* The newest customers are people: only for roles that may see customers. */}
            {can("customers.view") ? (
              <Panel
                title={t("newest")}
                id="newest-title"
                action={
                  <Link href="/admin/customers" className="inline-flex min-h-touch-target items-center gap-1 rounded-sm text-small font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring">
                    {t("allCustomers")}
                    <Icon icon={ArrowRight} size="sm" />
                  </Link>
                }
              >
                <ul className="grid grid-cols-1 gap-1">
                  {newest.map((customer) => (
                    <li key={customer.id}>
                      <Link href={`/admin/customers/${customer.id}`} className="flex min-w-0 items-center gap-3 rounded-md px-2 py-2 hover:bg-hover focus-visible:focus-ring">
                        <Avatar name={customer.name} size="sm" />
                        <span className="grid min-w-0 flex-1">
                          <span className="truncate text-small font-medium">
                            <bdi>{customer.name}</bdi>
                          </span>
                          <span className="truncate text-caption text-fg-tertiary">
                            {country(customer.country, locale, unknown)} · {timeAgo(customer.createdAt, now, locale)}
                          </span>
                        </span>
                        <PlanBadge customer={customer} />
                        <StatusBadges customer={customer} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}
            {teamWork}
          </div>
          <DemoNote />
        </>
      ) : null}
    </Screen>
  );
}
