"use client";

import { KpiTile } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, type CSSProperties } from "react";

import { Panel, Screen } from "@/features/app/screen";

import { bdi, isolate } from "./bidi";
import { CohortGrid, ColumnChart, RankedBars } from "./charts";
import { useCustomers } from "./customers/data";
import { DAY } from "./customers/model";
import { cohorts, funnel, lastDevice, REST, shares, signupsPerDay, visitedCount } from "./customers/stats";
import { DemoNote, FiguresWithheld } from "./customers/ui";
import { count, country, percent } from "./format";
import { useAdmin } from "./session";

/** Growth, activation, retention and who the customers are: the numbers behind product decisions. */
export function AdminAnalyticsScreen() {
  const t = useTranslations("admin.analytics");
  const tc = useTranslations("admin.customers");
  const tk = useTranslations("app.welcome.kinds");
  const locale = useLocale();
  const { role } = useAdmin();
  const { customers, now, ready, withheld, viewsMeasured } = useCustomers();

  const weekly = useMemo(() => {
    const days = signupsPerDay(customers, now, 84);
    return Array.from({ length: 12 }, (_, week) => {
      const slice = days.slice(week * 7, week * 7 + 7);
      return { date: slice[0]?.date ?? new Date(now - (12 - week) * 7 * DAY).toISOString(), value: slice.reduce((sum, day) => sum + day.value, 0) };
    });
  }, [customers, now]);
  const steps = useMemo(() => funnel(customers), [customers]);
  const grid = useMemo(() => cohorts(customers, now, 8), [customers, now]);
  const unknown = tc("unknownCountry");
  // Everything past the top entries folds into REST, never into a value such as the page kind "other".
  const label = (key: string, map: (key: string) => string) => (key === REST ? t("rest") : map(key));
  const breakdown = (values: string[], map: (key: string) => string, top = 6) => shares(values, top).map((share) => ({ key: share.key, label: label(share.key, map), value: share.value }));
  const total = customers.length || 1;
  const asShare = (value: number) => percent(value / total, locale);

  // Page visits and clicks of the last 30 days: the demo's sample numbers, or real accounts' once they are measured.
  const views = customers.reduce((sum, customer) => sum + customer.usage.views30, 0);
  const clicks = customers.reduce((sum, customer) => sum + customer.usage.clicks30, 0);
  const notMeasured = t("kpi.notMeasured");

  return (
    <Screen title={t("title")} lead={t("lead")} wide>
      {ready && withheld(role) ? <FiguresWithheld /> : null}
      {ready && !withheld(role) ? (
        <>
          <section aria-labelledby="a-pages-title" className="grid grid-cols-1 gap-3">
            <h2 id="a-pages-title" className="text-title rtl:tracking-normal">
              {t("pages")}
            </h2>
            {/* Never a 0 where nothing was measured: a dash and the words why. */}
            <dl data-kpis className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiTile label={t("kpi.views")} value={viewsMeasured ? count(views, locale) : "–"} footer={viewsMeasured ? t("kpi.window", { days: 30 }) : notMeasured} />
              <KpiTile label={t("kpi.clicks")} value={viewsMeasured ? count(clicks, locale) : "–"} footer={viewsMeasured ? t("kpi.window", { days: 30 }) : notMeasured} />
              <KpiTile label={t("kpi.ctr")} value={viewsMeasured && views > 0 ? percent(clicks / views, locale) : "–"} footer={viewsMeasured ? t.rich("kpi.ctrHint", { bdi }) : notMeasured} />
              <KpiTile label={t("kpi.visitedPages")} value={viewsMeasured ? count(visitedCount(customers), locale) : "–"} footer={viewsMeasured ? t("kpi.window", { days: 30 }) : notMeasured} />
            </dl>
          </section>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title={t("weekly")} id="weekly-title">
              <ColumnChart points={weekly} label={t("weekly")} format={(value) => count(value, locale)} />
            </Panel>
            <Panel title={t.markup("funnel", { bdi: isolate })} id="funnel-title">
              <ol className="grid gap-3">
                {steps.map((step, index) => {
                  const first = Math.max(1, steps[0]?.value ?? 0);
                  const before = steps[index - 1]?.value;
                  return (
                    <li key={step.key} className="grid gap-1">
                      <div className="flex items-baseline justify-between gap-3 text-small">
                        <span>{t.rich(`steps.${step.key}`, { bdi, count: 3 })}</span>
                        <span className="text-fg-secondary tabular-nums">
                          {count(step.value, locale)} · {percent(step.value / first, locale)}
                          {before ? <span className="text-fg-tertiary"> ({t("ofPrevious", { share: percent(step.value / before, locale) })})</span> : null}
                        </span>
                      </div>
                      <span aria-hidden className="block h-3 overflow-hidden rounded-full bg-canvas-muted">
                        <span className="block h-full w-(--w) rounded-full bg-primary" style={{ "--w": `${(step.value / first) * 100}%` } as CSSProperties} />
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="text-caption text-fg-tertiary">{t("funnelNote")}</p>
              {/* Visits are no step: "On Pro" must not hang on a number real accounts do not measure yet. */}
              <p data-visits className="text-small text-fg-secondary">
                {viewsMeasured ? t.rich("visited", { count: count(visitedCount(customers), locale), bdi }) : t.rich("visitedNotMeasured", { bdi })}
              </p>
            </Panel>
          </div>

          <Panel title={t("retention")} id="retention-title">
            <CohortGrid rows={grid} label={t("retention")} />
            <p className="text-caption text-fg-tertiary">{t("retentionNote")}</p>
          </Panel>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <Panel title={t("countries")} id="a-countries-title">
              <RankedBars label={t("countries")} items={breakdown(customers.map((customer) => customer.country || "unknown"), (key) => country(key === "unknown" ? "" : key, locale, unknown), 8)} format={asShare} />
            </Panel>
            <Panel title={t("kinds")} id="a-kinds-title">
              <RankedBars label={t("kinds")} items={breakdown(customers.map((customer) => customer.usage.kind), (key) => (tk.has(`${key}.label`) ? tk(`${key}.label`) : key), 8)} format={asShare} />
            </Panel>
            <Panel title={t("templates")} id="a-templates-title">
              <RankedBars label={t("templates")} items={breakdown(customers.map((customer) => customer.usage.template || "none"), (key) => (key === "none" ? t("none") : key.charAt(0).toUpperCase() + key.slice(1)))} format={asShare} />
            </Panel>
            <Panel title={t("systems")} id="a-systems-title">
              <RankedBars label={t("systems")} items={breakdown(customers.flatMap((customer) => lastDevice(customer)?.os ?? []), (key) => key)} format={asShare} />
            </Panel>
            <Panel title={t("languages")} id="a-languages-title">
              <RankedBars
                label={t("languages")}
                items={breakdown(customers.map((customer) => customer.locale), (key) => new Intl.DisplayNames([locale], { type: "language" }).of(key) ?? key)}
                format={asShare}
              />
            </Panel>
            <Panel title={t("browsers")} id="a-browsers-title">
              <RankedBars label={t("browsers")} items={breakdown(customers.flatMap((customer) => lastDevice(customer)?.browser ?? []), (key) => key)} format={asShare} />
            </Panel>
          </div>
          <DemoNote />
        </>
      ) : null}
    </Screen>
  );
}
