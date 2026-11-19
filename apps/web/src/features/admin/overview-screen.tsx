"use client";

import { Avatar, Button, Icon, Segmented } from "@linkyo/ui";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Euro,
  CalendarClock,
  CircleCheck,
  CreditCard,
  Eye,
  FilePen,
  Percent,
  Plus,
  Rocket,
  ShieldAlert,
  TrendingDown,
  UserPlus,
  UsersRound,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Panel, Screen } from "@/features/app/screen";
import { Link } from "@/i18n/navigation";

import { ActivityList } from "./activity-screen";
import { ColumnChart, KpiTile, RankedBars } from "./charts";
import { useCustomers } from "./customers/data";
import { daysAgo, riskFlags } from "./customers/model";
import { kpis, lastDevice, mrrByMonth, shares, signupsPerDay } from "./customers/stats";
import { DemoNote, PlanBadge, StatusBadges } from "./customers/ui";
import { useCreatorRows, usePublished } from "./data";
import { count, country, money, percent, timeAgo } from "./format";
import { useAdmin } from "./session";

const RANGES = ["7", "30", "90"] as const;

function Attention({
  icon,
  label,
  value,
  href,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  href: string;
  tone: "danger" | "warning" | "neutral";
}) {
  return (
    <li>
      <Link
        href={href}
        className="duration-micro hover:bg-hover focus-visible:focus-ring flex items-center gap-3 rounded-md px-2 py-2 transition-colors"
      >
        <span
          className={
            tone === "danger"
              ? "size-control-sm bg-danger-subtle text-danger-strong grid shrink-0 place-items-center rounded-md"
              : tone === "warning"
                ? "size-control-sm bg-warning-subtle text-warning-strong grid shrink-0 place-items-center rounded-md"
                : "size-control-sm bg-canvas-muted text-fg-secondary grid shrink-0 place-items-center rounded-md"
          }
        >
          <Icon icon={icon} size="sm" />
        </span>
        <span className="text-small min-w-0 flex-1">{label}</span>
        <span className="text-body font-semibold tabular-nums">{value}</span>
        <Icon icon={ArrowRight} size="sm" className="text-fg-tertiary rtl:-scale-x-100" />
      </Link>
    </li>
  );
}

/** The whole business at a glance: customers, revenue, growth, where people are, what needs a look. */
export function OverviewScreen() {
  const t = useTranslations("admin.overview");
  const tc = useTranslations("admin.customers");
  const ts = useTranslations("admin.security");
  const locale = useLocale();
  const { db, me, can } = useAdmin();
  const { customers, now, ready, blockedIps } = useCustomers();
  const [rangeKey, setRange] = useState<(typeof RANGES)[number]>("30");
  const range = Number(rangeKey);
  const published = usePublished(db.token);
  const rows = useCreatorRows(db, published);

  const numbers = useMemo(() => kpis(customers, now, range), [customers, now, range]);
  const signups = useMemo(() => signupsPerDay(customers, now, range), [customers, now, range]);
  const revenue = useMemo(() => mrrByMonth(customers, now, 6), [customers, now]);
  const countries = useMemo(
    () =>
      shares(
        customers.map((customer) => customer.country || "unknown"),
        6,
      ),
    [customers],
  );
  const devices = useMemo(
    () => shares(customers.flatMap((customer) => lastDevice(customer)?.type ?? [])),
    [customers],
  );
  const blocked = useMemo(() => new Set(blockedIps.map((entry) => entry.ip)), [blockedIps]);
  const risky = useMemo(
    () =>
      customers.filter((customer) =>
        customer.logins.some(
          (login) => daysAgo(now, login.at) <= 1 && riskFlags(login, customer.logins, blocked).length > 0,
        ),
      ).length,
    [customers, now, blocked],
  );
  const trialsEnding = customers.filter(
    (customer) =>
      customer.subscription.status === "trialing" &&
      customer.subscription.trialEndsAt &&
      daysAgo(now, customer.subscription.trialEndsAt) >= -3,
  ).length;
  const newest = customers
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const pagesCount = (status: "draft" | "ready" | "published") =>
    rows.filter((row) => row.status === status).length;
  const live = published.status === "ready" ? published.pages.length : 0;
  const unknown = tc("unknownCountry");

  return (
    <Screen
      title={t("title", { name: me.name.split(" ")[0] ?? me.name })}
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
      <Segmented
        label={t("range")}
        value={rangeKey}
        onValueChange={setRange}
        className="justify-self-start"
        options={RANGES.map((days) => ({ value: days, label: t("days", { days: Number(days) }) }))}
      />
      {ready ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile
              icon={UsersRound}
              label={t("kpi.customers")}
              value={count(numbers.customers, locale)}
              hint={t("kpi.customersHint", { active: count(numbers.active7, locale) })}
            />
            <KpiTile
              icon={UserPlus}
              label={t("kpi.new", { days: range })}
              value={count(numbers.newCustomers, locale)}
              hint={t("kpi.newHint", {
                perDay: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
                  numbers.newCustomers / range,
                ),
              })}
            />
            {can("billing.view") ? (
              <>
                <KpiTile
                  icon={Euro}
                  label={t("kpi.mrr")}
                  value={money(numbers.mrr, locale)}
                  hint={t("kpi.mrrHint", { arr: money(numbers.mrr * 12, locale) })}
                />
                <KpiTile
                  icon={CreditCard}
                  label={t("kpi.paying")}
                  value={count(numbers.paying, locale)}
                  hint={t("kpi.payingHint", { trialing: numbers.trialing })}
                />
                <KpiTile
                  icon={Percent}
                  label={t("kpi.conversion")}
                  value={percent(numbers.conversion, locale)}
                  hint={t("kpi.conversionHint")}
                />
                <KpiTile
                  icon={TrendingDown}
                  label={t("kpi.churn", { days: range })}
                  value={percent(numbers.churn, locale)}
                  hint={t("kpi.churnHint")}
                  tone={numbers.churn > 0.05 ? "warning" : "neutral"}
                />
              </>
            ) : null}
            <KpiTile
              icon={Activity}
              label={t("kpi.active")}
              value={count(numbers.active7, locale)}
              hint={t("kpi.activeHint", {
                share: percent(numbers.customers ? numbers.active7 / numbers.customers : 0, locale),
              })}
            />
            <KpiTile
              icon={Eye}
              label={t("kpi.views")}
              value={count(numbers.views, locale)}
              hint={t("kpi.viewsHint")}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title={t("signupsTitle")} id="signups-title">
              <ColumnChart
                points={signups}
                label={t("signupsTitle")}
                format={(value) => count(value, locale)}
              />
            </Panel>
            {can("billing.view") ? (
              <Panel title={t("mrrTitle")} id="mrr-title">
                <ColumnChart
                  points={revenue}
                  label={t("mrrTitle")}
                  format={(value) => money(value, locale)}
                  dateStyle="month"
                />
              </Panel>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel title={t("attention")} id="attention-title">
              <ul className="grid grid-cols-1 gap-1">
                {can("billing.view") ? (
                  <Attention
                    icon={AlertTriangle}
                    label={t("pastDue")}
                    value={numbers.pastDue}
                    href="/admin/subscriptions?status=past_due"
                    tone={numbers.pastDue ? "danger" : "neutral"}
                  />
                ) : null}
                {can("security.view") ? (
                  <Attention
                    icon={ShieldAlert}
                    label={t("risky")}
                    value={risky}
                    href="/admin/security?filter=risky"
                    tone={risky ? "warning" : "neutral"}
                  />
                ) : null}
                {can("billing.view") ? (
                  <Attention
                    icon={CalendarClock}
                    label={t("trialsEnding")}
                    value={trialsEnding}
                    href="/admin/subscriptions?status=trialing"
                    tone={trialsEnding ? "warning" : "neutral"}
                  />
                ) : null}
                <Attention
                  icon={UserX}
                  label={t("suspended")}
                  value={numbers.suspended}
                  href="/admin/customers?status=suspended"
                  tone="neutral"
                />
              </ul>
            </Panel>
            <Panel title={t("countries")} id="countries-title">
              <RankedBars
                label={t("countries")}
                items={countries.map((share) => ({
                  key: share.key,
                  label:
                    share.key === "other"
                      ? t("other")
                      : country(share.key === "unknown" ? "" : share.key, locale, unknown),
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
            <Panel
              title={t("newest")}
              id="newest-title"
              action={
                <Link
                  href="/admin/customers"
                  className="text-small text-link focus-visible:focus-ring inline-flex items-center gap-1 rounded-sm font-medium hover:underline"
                >
                  {t("allCustomers")}
                  <Icon icon={ArrowRight} size="sm" className="rtl:-scale-x-100" />
                </Link>
              }
            >
              <ul className="grid grid-cols-1 gap-1">
                {newest.map((customer) => (
                  <li key={customer.id}>
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="hover:bg-hover focus-visible:focus-ring flex min-w-0 items-center gap-3 rounded-md px-2 py-2"
                    >
                      <Avatar name={customer.name} size="sm" />
                      <span className="grid min-w-0 flex-1">
                        <span className="text-small truncate font-medium">{customer.name}</span>
                        <span className="text-caption text-fg-tertiary truncate">
                          {country(customer.country, locale, unknown)} ·{" "}
                          {timeAgo(customer.createdAt, now, locale)}
                        </span>
                      </span>
                      <PlanBadge customer={customer} />
                      <StatusBadges customer={customer} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel
              title={t("teamWork")}
              id="team-work-title"
              action={
                <Link
                  href="/admin/activity"
                  className="text-small text-link focus-visible:focus-ring inline-flex items-center gap-1 rounded-sm font-medium hover:underline"
                >
                  {t("allActivity")}
                  <Icon icon={ArrowRight} size="sm" className="rtl:-scale-x-100" />
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
                  <div key={key} className="bg-canvas-muted grid gap-1 rounded-md p-3">
                    <dt className="text-caption text-fg-secondary flex items-center gap-1">
                      <Icon icon={icon} size="sm" />
                      {t(key)}
                    </dt>
                    <dd className="text-h3 tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              {db.activity.length > 0 ? (
                <ActivityList events={db.activity.slice(0, 4)} now={now} />
              ) : (
                <p className="text-small text-fg-secondary">{t("noActivity")}</p>
              )}
            </Panel>
          </div>
          <DemoNote />
        </>
      ) : null}
    </Screen>
  );
}
