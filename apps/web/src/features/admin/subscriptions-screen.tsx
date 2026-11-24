"use client";

import { Avatar, Badge, Icon, Segmented } from "@linkyo/ui";
import { AlertTriangle, CalendarClock, CreditCard, Euro, Gift, Repeat, TrendingDown, UserRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Panel, Screen } from "@/features/app/screen";
import { Link } from "@/i18n/navigation";

import { ColumnChart, KpiTile } from "./charts";
import { useCustomers } from "./customers/data";
import { hasProForLife, monthlyRevenue, PLAN_PRICE, SUBSCRIPTION_STATUSES, subscriptionSource, type SubscriptionStatus } from "./customers/model";
import { kpis, mrrByMonth } from "./customers/stats";
import { DemoNote, StatusBadges } from "./customers/ui";
import { count, date, money, percent } from "./format";

type Filter = "all" | SubscriptionStatus;

/** Revenue and every Pro plan (paid through Stripe or given by the team): what comes in, what's at risk. */
export function SubscriptionsScreen() {
  const t = useTranslations("admin.subscriptions");
  const tc = useTranslations("admin.customers");
  const tSource = useTranslations("admin.customer.sources");
  const locale = useLocale();
  const params = useSearchParams();
  const { customers, now, ready } = useCustomers();
  const [filter, setFilter] = useState<Filter>(SUBSCRIPTION_STATUSES.find((status) => status === params.get("status")) ?? "all");
  const numbers = useMemo(() => kpis(customers, now, 30), [customers, now]);
  const months = useMemo(() => mrrByMonth(customers, now, 12), [customers, now]);
  const paid = useMemo(
    () =>
      customers
        .filter((customer) => customer.subscription.plan !== "free" && (filter === "all" || customer.subscription.status === filter))
        .sort((a, b) => (b.subscription.startedAt ?? "").localeCompare(a.subscription.startedAt ?? "")),
    [customers, filter],
  );
  const arpu = numbers.paying ? numbers.mrr / numbers.paying : 0;
  // Rewards from the invite program: shown here so nobody adds them in, never part of the numbers above.
  const proForLife = useMemo(() => customers.filter(hasProForLife).length, [customers]);

  return (
    <Screen title={t("title")} lead={t("lead")} wide>
      {ready ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile icon={Euro} label={t("mrr")} value={money(numbers.mrr, locale)} hint={t("arr", { arr: money(numbers.mrr * 12, locale) })} />
            <KpiTile icon={UserRound} label={t("paying")} value={count(numbers.paying, locale)} hint={t("arpu", { arpu: money(arpu, locale, true) })} />
            <KpiTile icon={CalendarClock} label={t("trialing")} value={count(numbers.trialing, locale)} hint={t("trialingHint")} />
            <KpiTile icon={AlertTriangle} label={t("pastDue")} value={count(numbers.pastDue, locale)} hint={t("pastDueHint")} tone={numbers.pastDue ? "danger" : "neutral"} />
          </div>
          <p className="-mt-2 flex items-center gap-2 text-small text-fg-secondary">
            <Icon icon={Gift} size="sm" className="shrink-0" />
            {t("proForLife", { count: count(proForLife, locale) })}
          </p>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title={t("mrrTitle")} id="mrr-months-title">
              <ColumnChart points={months} label={t("mrrTitle")} format={(value) => money(value, locale)} dateStyle="month" />
            </Panel>
            <Panel title={t("plans")} id="plans-title">
              <ul className="grid gap-2">
                <li className="flex items-center justify-between gap-3 rounded-md border border-line p-3">
                  <span className="grid">
                    <span className="text-small font-semibold">{tc("plans.free")}</span>
                    <span className="text-caption text-fg-secondary">{t("freeHint")}</span>
                  </span>
                  <span className="text-body font-semibold tabular-nums">{money(PLAN_PRICE.free, locale)}</span>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-md border border-line p-3">
                  <span className="grid">
                    <span className="text-small font-semibold">Pro</span>
                    <span className="text-caption text-fg-secondary">{t("proHint")}</span>
                  </span>
                  <span className="text-body font-semibold tabular-nums">
                    {money(PLAN_PRICE.pro, locale, true)}
                    <span className="text-caption font-regular text-fg-secondary"> / {t("month")}</span>
                  </span>
                </li>
              </ul>
              <dl className="grid grid-cols-2 gap-2">
                <div className="grid gap-1 rounded-md bg-canvas-muted p-3">
                  <dt className="flex items-center gap-1 text-caption text-fg-secondary">
                    <Icon icon={Repeat} size="sm" />
                    {t("conversion")}
                  </dt>
                  <dd className="text-h3 tabular-nums">{percent(numbers.conversion, locale)}</dd>
                </div>
                <div className="grid gap-1 rounded-md bg-canvas-muted p-3">
                  <dt className="flex items-center gap-1 text-caption text-fg-secondary">
                    <Icon icon={TrendingDown} size="sm" />
                    {t("churn")}
                  </dt>
                  <dd className="text-h3 tabular-nums">{percent(numbers.churn, locale)}</dd>
                </div>
              </dl>
            </Panel>
          </div>

          <Panel title={t("list")} id="list-title" action={<span className="text-small text-fg-secondary">{t("count", { count: paid.length })}</span>}>
            {/* Wider than a phone in German: the strip scrolls sideways inside the card, never the page. */}
            <div className="-mx-4 -my-1 overflow-x-auto px-4 py-1 md:mx-0 md:px-0">
              <Segmented
                label={t("filter")}
                value={filter}
                onValueChange={setFilter}
                className="whitespace-nowrap"
                options={(["all", ...SUBSCRIPTION_STATUSES] as const).map((value) => ({ value, label: value === "all" ? tc("all") : tc(`subscription.${value}`) }))}
              />
            </div>
            {paid.length === 0 ? (
              <p className="flex items-center gap-2 text-small text-fg-secondary">
                <Icon icon={CreditCard} size="sm" />
                {t("empty")}
              </p>
            ) : (
              <div className="overflow-x-auto" role="region" aria-labelledby="list-title" tabIndex={0}>
                <table className="w-full min-w-prose text-small">
                  <thead className="text-caption text-fg-secondary">
                    <tr>
                      <th scope="col" className="py-2 text-start font-medium">
                        {tc("columns.customer")}
                      </th>
                      <th scope="col" className="py-2 text-start font-medium">
                        {t("columns.status")}
                      </th>
                      <th scope="col" className="py-2 text-start font-medium">
                        {t("columns.source")}
                      </th>
                      <th scope="col" className="py-2 text-start font-medium">
                        {t("columns.since")}
                      </th>
                      <th scope="col" className="py-2 text-start font-medium">
                        {t("columns.next")}
                      </th>
                      <th scope="col" className="py-2 text-end font-medium">
                        {t("columns.invoices")}
                      </th>
                      <th scope="col" className="py-2 text-end font-medium">
                        {t("columns.mrr")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paid.slice(0, 100).map((customer) => {
                      const sub = customer.subscription;
                      const next = sub.status === "trialing" ? sub.trialEndsAt : sub.status === "canceled" ? undefined : sub.renewsAt;
                      return (
                        <tr key={customer.id} className="border-t border-line hover:bg-hover">
                          <th scope="row" className="py-2 text-start font-regular">
                            <Link href={`/admin/customers/${customer.id}`} className="flex min-w-0 items-center gap-2 rounded-sm focus-visible:focus-ring">
                              <Avatar name={customer.name} size="sm" />
                              <span className="truncate font-medium">{customer.name}</span>
                            </Link>
                          </th>
                          <td className="py-2">
                            <StatusBadges customer={customer} />
                          </td>
                          <td className="py-2">
                            {(() => {
                              const source = subscriptionSource(customer);
                              return source ? (
                                <Badge size="sm" tone={source === "stripe" ? "primary" : "outline"} data-source={source}>
                                  {tSource(source)}
                                </Badge>
                              ) : null;
                            })()}
                          </td>
                          <td className="py-2 whitespace-nowrap text-fg-secondary">{sub.startedAt ? date(sub.startedAt, locale) : "–"}</td>
                          <td className="py-2 whitespace-nowrap text-fg-secondary">{next ? date(next, locale) : "–"}</td>
                          <td className="py-2 text-end tabular-nums">{sub.invoices.length}</td>
                          <td className="py-2 text-end tabular-nums">{money(monthlyRevenue(customer, now), locale, true)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <p className="text-caption text-fg-tertiary">{t("teamNote")}</p>
          <DemoNote />
        </>
      ) : null}
    </Screen>
  );
}
