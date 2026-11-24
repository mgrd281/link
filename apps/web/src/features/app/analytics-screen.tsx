"use client";

import { Badge, cn, Icon, Segmented } from "@linkyo/ui";
import { ArrowDownRight, ArrowUpRight, ChartNoAxesColumn, Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";

import { sampleStats, totals, type DayStat } from "./sample-stats";
import { Panel, Screen } from "./screen";
import { useSite } from "./site-context";
import { statsSource } from "./stats";

type Range = "7" | "30" | "90";

const niceMax = (value: number) => {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value / 4) ?? 10;
  return Math.ceil(value / (step * magnitude)) * step * magnitude;
};

/**
 * Stat tile: label, value, change vs the previous period (sign + arrow + words, never color alone).
 * Three fit side by side on a phone, so the comparison is said once under the row and only read out
 * per tile.
 */
function StatTile({ label, value, change, previousLabel }: { label: string; value: string; change: number | null; previousLabel: string }) {
  const locale = useLocale();
  const up = (change ?? 0) >= 0;
  return (
    <div className="grid min-w-0 content-start gap-1 rounded-lg border border-line bg-surface p-3 group-data-[grouped]/app:bg-group max-lg:group-data-[grouped]/app:border-transparent">
      <dt className="truncate text-caption text-fg-secondary">{label}</dt>
      <dd className="text-h3 tabular-nums md:text-h2">{value}</dd>
      {change !== null ? (
        <dd className={cn("flex items-center gap-1 text-caption", up ? "text-success-strong" : "text-danger-strong")}>
          {/* The trend leans into the reading direction: up and to the end, also in Arabic. */}
          <Icon icon={up ? ArrowUpRight : ArrowDownRight} size="sm" />
          <span className="font-semibold tabular-nums">{new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0, signDisplay: "always" }).format(change)}</span>
          <span className="sr-only">{previousLabel}</span>
        </dd>
      ) : null}
    </div>
  );
}

/**
 * Daily views as columns (one series, one hue, one axis). Hover or arrow keys show the day's
 * views and clicks; the same numbers are in the table below for screen readers and copying.
 */
function ViewsChart({ days, label }: { days: DayStat[]; label: string }) {
  const t = useTranslations("app.analytics");
  const locale = useLocale();
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(...days.map((day) => day.views)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f));
  const number = (n: number) => new Intl.NumberFormat(locale, { notation: n >= 10_000 ? "compact" : "standard" }).format(n);
  const date = (iso: string, long = false) =>
    new Intl.DateTimeFormat(locale, long ? { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));
  const current = active !== null ? days[active] : undefined;
  const readout = (day: DayStat | undefined) => (day ? `${date(day.date, true)}: ${number(day.views)} ${t("views")}, ${number(day.clicks)} ${t("clicks")}` : "");
  // At most four dates under the columns: six overlapped on a phone ("23. Okt.28. Okt.").
  const every = Math.ceil(days.length / 4);

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    if (event.key === forward || event.key === back || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActive((index) => {
        if (event.key === "Home") return 0;
        if (event.key === "End") return days.length - 1;
        const from = index ?? days.length - 1;
        return Math.max(0, Math.min(days.length - 1, from + (event.key === forward ? 1 : -1)));
      });
    } else if (event.key === "Escape") setActive(null);
  };

  return (
    <figure className="grid grid-cols-1 gap-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        <div aria-hidden className="relative h-(--container-menu) w-10 text-end text-caption text-fg-tertiary tabular-nums">
          {ticks.map((tick) => (
            <span key={tick} className="absolute end-0 bottom-(--y) translate-y-1/2" style={{ "--y": `${(tick / top) * 100}%` } as CSSProperties}>
              {number(tick)}
            </span>
          ))}
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label={t("chartKeys", { label })}
          aria-valuemin={1}
          aria-valuemax={days.length}
          aria-valuenow={(active ?? days.length - 1) + 1}
          aria-valuetext={readout(days[active ?? days.length - 1])}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          className="relative h-(--container-menu) rounded-sm focus-visible:focus-ring"
        >
          {ticks.map((tick) => (
            <span key={tick} aria-hidden className="absolute inset-x-0 bottom-(--y) border-t border-line" style={{ "--y": `${(tick / top) * 100}%` } as CSSProperties} />
          ))}
          <ol className="absolute inset-0 grid grid-flow-col auto-cols-fr items-end gap-0.5">
            {days.map((day, index) => (
              <li
                key={day.date}
                onPointerEnter={() => setActive(index)}
                className="flex h-full items-end justify-center"
                aria-hidden
              >
                <span
                  className={cn(
                    "h-(--h) w-full max-w-6 rounded-t-xs bg-primary transition-opacity duration-micro",
                    active !== null && active !== index && "opacity-secondary",
                  )}
                  style={{ "--h": `${Math.max(1, (day.views / top) * 100)}%` } as CSSProperties}
                />
              </li>
            ))}
          </ol>
          {current && active !== null ? (
            <div
              aria-hidden
              className="pointer-events-none absolute start-(--x) top-0 layer-popover grid min-w-32 -translate-x-1/2 gap-1 rounded-md border border-line bg-surface-elevated p-2 text-small rtl:translate-x-1/2"
              style={{ "--x": `${((active + 0.5) / days.length) * 100}%` } as CSSProperties}
            >
              <span className="text-caption text-fg-secondary">{date(current.date, true)}</span>
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-3 rounded-full bg-primary" />
                <strong className="font-semibold tabular-nums">{number(current.views)}</strong>
                <span className="text-fg-secondary">{t("views")}</span>
              </span>
              <span className="flex items-center gap-2 ps-5">
                <strong className="font-semibold tabular-nums">{number(current.clicks)}</strong>
                <span className="text-fg-secondary">{t("clicks")}</span>
              </span>
            </div>
          ) : null}
        </div>
        <span />
        <ol aria-hidden className="grid grid-flow-col auto-cols-fr pt-2 text-caption text-fg-tertiary">
          {days.map((day, index) => (
            <li key={day.date} className="overflow-visible text-center whitespace-nowrap">
              {index % every === 0 ? date(day.date) : ""}
            </li>
          ))}
        </ol>
      </div>
      <details className="rounded-md border border-line">
        <summary className="flex h-control-md cursor-pointer items-center rounded-md px-3 text-small font-medium focus-visible:focus-ring">{t("table")}</summary>
        <div className="max-h-(--container-menu) overflow-y-auto border-t border-line" tabIndex={0} role="region" aria-label={t("table")}>
          <table className="w-full text-small">
            <thead className="sticky top-0 bg-surface text-fg-secondary group-data-[grouped]/app:bg-group">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("date")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("views")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("clicks")}
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {days.map((day) => (
                <tr key={day.date} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 text-start font-regular">
                    {date(day.date, true)}
                  </th>
                  <td className="px-3 py-2 text-end">{number(day.views)}</td>
                  <td className="px-3 py-2 text-end">{number(day.clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Ranked horizontal bars: name and value in text colors, one thin bar in the series hue. */
function BarList({ items }: { items: { key: string; label: string; value: string; share: number }[] }) {
  const max = Math.max(...items.map((item) => item.share), 0.0001);
  return (
    <ul className="grid grid-cols-1 gap-3">
      {items.map((item) => (
        <li key={item.key} className="grid grid-cols-1 gap-1">
          <span className="flex items-baseline justify-between gap-3 text-small">
            <span dir="auto" className="min-w-0 truncate font-medium">
              {item.label}
            </span>
            <span className="shrink-0 text-fg-secondary tabular-nums">{item.value}</span>
          </span>
          <span aria-hidden className="h-2 overflow-hidden rounded-full bg-canvas-muted">
            <span className="block h-full w-(--w) rounded-full bg-primary" style={{ "--w": `${(item.share / max) * 100}%` } as CSSProperties} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Real accounts: nothing is counted yet, so nothing is shown as if it were. One calm card says so
 * (the counter without cookies is in the works); the footnote about how Linkyo counts waits for it.
 */
function AnalyticsEmpty() {
  const t = useTranslations("app.analytics");
  return (
    <Screen title={t("title")} wide lead={t("leadReal")}>
      <Panel>
        <div className="grid justify-items-center gap-4 py-6 text-center">
          <span className="grid size-control-xl place-items-center rounded-full bg-selected text-selected-fg">
            <Icon icon={ChartNoAxesColumn} size="lg" />
          </span>
          <div className="grid grid-cols-1 gap-1">
            <h2 className="text-title rtl:tracking-normal">{t("empty.title")}</h2>
            <p className="max-w-prose text-small font-regular text-fg-secondary">{t("empty.body")}</p>
          </div>
        </div>
      </Panel>
    </Screen>
  );
}

/**
 * Analytics: one range filter above everything, stat tiles, the daily chart, then where clicks go
 * and where visitors come from. Demo numbers are labelled as samples on every view; real accounts
 * see an empty state until counting exists (statsSource).
 */
export function AnalyticsScreen() {
  return statsSource() === "sample" ? <SampleAnalytics /> : <AnalyticsEmpty />;
}

function SampleAnalytics() {
  const t = useTranslations("app.analytics");
  const locale = useLocale();
  const { account, doc, label } = useSite();
  const [range, setRange] = useState<Range>("30");
  const stats = useMemo(() => sampleStats(account.username, doc.blocks, Number(range)), [account.username, doc.blocks, range]);
  const sum = totals(stats.days);
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  const percent = (n: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: n < 0.1 ? 1 : 0 }).format(n);
  const change = (now: number, before: number) => (before ? now / before - 1 : null);
  const prevCtr = stats.previous.views ? stats.previous.clicks / stats.previous.views : 0;
  const regions = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
  const previousLabel = t("vsPrevious", { days: range });
  const top = stats.links[0];

  return (
    <Screen
      title={t("title")}
      wide
      // Said once, next to the title: every number on this screen is a sample until the page is live.
      actions={
        <Badge size="sm" tone="outline">
          {t("sample")}
        </Badge>
      }
      lead={t("lead")}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Full width on phones, like an iOS segmented control; its natural width from sm up. It sits on
            the tinted ground, so its track takes the next tint step to stay visible as a control. */}
        <Segmented<Range>
          label={t("range")}
          value={range}
          onValueChange={setRange}
          className="w-full bg-tinted *:flex-1 pointer-coarse:h-control-lg sm:w-auto sm:*:flex-none"
          options={(["7", "30", "90"] as const).map((value) => ({ value, label: t("days", { days: value }) }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-2">
        <dl className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatTile label={t("views")} value={number(sum.views)} change={change(sum.views, stats.previous.views)} previousLabel={previousLabel} />
          <StatTile label={t("clicks")} value={number(sum.clicks)} change={change(sum.clicks, stats.previous.clicks)} previousLabel={previousLabel} />
          <StatTile label={t("ctr")} value={percent(sum.ctr)} change={change(sum.ctr, prevCtr)} previousLabel={previousLabel} />
        </dl>
        {/* Each tile reads its comparison out; on screen it is said once for all three. */}
        {stats.previous.views > 0 ? (
          <p aria-hidden className="text-caption text-fg-tertiary">
            {previousLabel}
          </p>
        ) : null}
        {/* The screen's question ("is my page working?") answered in one sentence, before the chart.
            The title is isolated, so a Latin title in an Arabic sentence (or the other way) keeps its order. */}
        {top && top.clicks > 0 ? <p className="text-small font-regular text-fg">{t("topInsight", { title: `\u2068${label(top.block)}\u2069` })}</p> : null}
      </div>

      <Panel title={t("viewsPerDay")} id="views-chart-title">
        <ViewsChart days={stats.days} label={t("viewsPerDay")} />
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title={t("topLinks")} id="top-links-title">
          {stats.links.length === 0 ? (
            <p className="flex items-start gap-2 text-small text-fg-secondary">
              <Icon icon={Info} size="sm" className="mt-0.5 shrink-0" />
              {t("noLinks")}
            </p>
          ) : (
            <BarList
              items={stats.links.slice(0, 8).map(({ block, clicks }) => ({
                key: block.id,
                label: label(block),
                value: number(clicks),
                share: clicks,
              }))}
            />
          )}
        </Panel>
        <Panel title={t("sources")} id="sources-title">
          <BarList items={stats.sources.map((source) => ({ key: source.key, label: t(`sourceNames.${source.key}`), value: percent(source.share), share: source.share }))} />
        </Panel>
        <Panel title={t("countries")} id="countries-title">
          <BarList items={stats.countries.map((country) => ({ key: country.code, label: regions.of(country.code) ?? country.code, value: percent(country.share), share: country.share }))} />
        </Panel>
        <Panel title={t("devices")} id="devices-title">
          <BarList items={stats.devices.map((device) => ({ key: device.key, label: t(`deviceNames.${device.key}`), value: percent(device.share), share: device.share }))} />
        </Panel>
      </div>

      {/* A footnote on the ground, on the column's edge like the lead at the top (a box in the ground's own fill only indented it). */}
      <p className="flex items-start gap-2 text-small font-regular text-fg-secondary">
        <Icon icon={Info} size="sm" className="mt-0.5 shrink-0" />
        {t("privacy")}
      </p>
    </Screen>
  );
}
