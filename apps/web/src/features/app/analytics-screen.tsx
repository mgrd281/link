"use client";

import { Badge, Button, ChartTable, cn, Icon, icons, KpiTile, Segmented, type KpiDelta } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import type { KeyCount } from "@/features/analytics/answer";

import { sampleStats, totals as sampleTotals } from "./sample-stats";
import { Panel, Screen } from "./screen";
import { useSite } from "./site-context";
import { reloadLiveStats, STATS_RANGES, statsCsv, statsSource, useLiveStats, type LiveStats, type StatsDay, type StatsRange } from "./stats";

const niceMax = (value: number) => {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value / 4) ?? 10;
  return Math.ceil(value / (step * magnitude)) * step * magnitude;
};

const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;

/** What the screen draws, the same for the demo's samples and a real account's counts. */
interface ScreenStats {
  sample: boolean;
  range: StatsRange;
  from: string;
  to: string;
  days: StatsDay[];
  totals: { views: number; visitors: number | null; clicks: number };
  /** The period just before; null when it was not counted from its first day. */
  previous: { views: number; visitors: number | null; clicks: number } | null;
  links: { key: string; label: string; clicks: number }[];
  sources: { key: string; label: string; share: number }[];
  countries: { key: string; label: string; share: number }[];
  devices: { key: string; label: string; share: number }[];
}

/**
 * Daily views as columns (one series, one hue, one axis). Hover or arrow keys show the day's
 * numbers; the same numbers are one tap away in the table below (ChartTable). A day before counting
 * began has no column and reads "not counted yet", never 0.
 */
function ViewsChart({ days, label, visitors }: { days: StatsDay[]; label: string; visitors: boolean }) {
  const t = useTranslations("app.analytics");
  const tTable = useTranslations("ui.chartTable");
  const locale = useLocale();
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...days.map((day) => day.views ?? 0)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f));
  const number = (n: number) => new Intl.NumberFormat(locale, { notation: n >= 10_000 ? "compact" : "standard" }).format(n);
  const date = (iso: string, long = false) =>
    new Intl.DateTimeFormat(locale, long ? { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));
  const current = active !== null ? days[active] : undefined;
  const readout = (day: StatsDay | undefined) => {
    if (!day) return "";
    if (day.views === null) return `${date(day.date, true)}: ${t("notCounted")}`;
    return `${date(day.date, true)}: ${number(day.views)} ${t("views")}, ${number(day.clicks ?? 0)} ${t("clicks")}`;
  };
  // At most four dates under the columns: six overlapped on a phone ("23. Okt.28. Okt.").
  const every = Math.ceil(days.length / 4);
  const cell = (value: number | null) =>
    value === null ? (
      <>
        <span aria-hidden>–</span>
        <span className="sr-only">{t("notCounted")}</span>
      </>
    ) : (
      number(value)
    );

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
              <li key={day.date} onPointerEnter={() => setActive(index)} className="flex h-full items-end justify-center" aria-hidden>
                {day.views === null ? null : (
                  <span
                    className={cn(
                      "h-(--h) w-full max-w-6 rounded-t-xs bg-primary transition-opacity duration-micro motion-reduce:transition-none",
                      active !== null && active !== index && "opacity-secondary",
                    )}
                    style={{ "--h": `${Math.max(1, (day.views / top) * 100)}%` } as CSSProperties}
                  />
                )}
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
              {current.views === null ? (
                <span className="text-fg-secondary">{t("notCounted")}</span>
              ) : (
                <>
                  <span className="flex items-center gap-2">
                    <span className="h-0.5 w-3 rounded-full bg-primary" />
                    <strong className="font-semibold tabular-nums">{number(current.views)}</strong>
                    <span className="text-fg-secondary">{t("views")}</span>
                  </span>
                  <span className="flex items-center gap-2 ps-5">
                    <strong className="font-semibold tabular-nums">{number(current.clicks ?? 0)}</strong>
                    <span className="text-fg-secondary">{t("clicks")}</span>
                  </span>
                </>
              )}
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
      <ChartTable<StatsDay>
        caption={t("dailyTable")}
        showLabel={tTable("show")}
        hideLabel={tTable("hide")}
        rows={days}
        rowKey={(day) => day.date}
        columns={[
          { key: "date", label: t("date"), cell: (day) => date(day.date, true) },
          { key: "views", label: t("views"), numeric: true, cell: (day) => cell(day.views) },
          ...(visitors ? [{ key: "visitors", label: t("visitors"), numeric: true, cell: (day: StatsDay) => cell(day.visitors) }] : []),
          { key: "clicks", label: t("clicks"), numeric: true, cell: (day) => cell(day.clicks) },
        ]}
      />
    </figure>
  );
}

/** Ranked horizontal bars: name and value in text colors, one thin bar in the series hue. */
function BarList({ items, empty }: { items: { key: string; label: string; value: string; share: number }[]; empty: string }) {
  if (items.length === 0)
    return (
      <p className="flex items-start gap-2 text-small text-fg-secondary">
        <Icon icon={icons.info} size="sm" className="mt-0.5 shrink-0" />
        {empty}
      </p>
    );
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

/** A centred note in a card: an icon in a circle, a title, a line, and optionally an action. */
function Notice({ icon, title, body, children }: { icon: typeof icons.analytics; title: string; body: string; children?: ReactNode }) {
  return (
    <Panel>
      <div className="grid justify-items-center gap-4 py-6 text-center">
        <span className="grid size-control-xl place-items-center rounded-full bg-selected text-selected-fg">
          <Icon icon={icon} size="lg" />
        </span>
        <div className="grid grid-cols-1 gap-1">
          <h2 className="text-title rtl:tracking-normal">{title}</h2>
          <p className="max-w-prose text-small font-regular text-fg-secondary">{body}</p>
        </div>
        {children}
      </div>
    </Panel>
  );
}

/**
 * Real accounts while nothing is counted (the server switch is off, or the database has no
 * statistics yet): nothing is shown as if it were. One calm card says so.
 */
function AnalyticsEmpty() {
  const t = useTranslations("app.analytics");
  return (
    <Screen title={t("title")} wide lead={t("leadReal")}>
      <Notice icon={icons.analytics} title={t("empty.title")} body={t("empty.body")} />
    </Screen>
  );
}

/**
 * Stats: one range filter above everything, key figures with their change, the daily chart (its
 * numbers one tap away and as CSV), then where taps go and where visitors come from. The demo's
 * numbers are samples, labelled as such; a real account sees its own cookie-free counts once counting
 * is on, and today's honest "coming soon" until then (statsSource, useLiveStats).
 */
export function AnalyticsScreen() {
  return statsSource() === "sample" ? <SampleAnalytics /> : <LiveAnalytics />;
}

/** A list of counts as shares of their total, named. */
const asShares = (counts: readonly KeyCount[], name: (key: string) => string) => {
  const total = counts.reduce((sum, item) => sum + item.count, 0) || 1;
  return counts.map((item) => ({ key: item.key, label: name(item.key), share: item.count / total }));
};

function LiveAnalytics() {
  const t = useTranslations("app.analytics");
  const locale = useLocale();
  const { account, doc, label } = useSite();
  const [range, setRange] = useState<StatsRange>(30);
  const state = useLiveStats(account.id, range);
  // While another range loads, the last numbers stay on screen (marked busy) instead of a skeleton.
  const [last, setLast] = useState<LiveStats | null>(null);
  if (state.status === "ready" && state.stats !== last) setLast(state.stats);
  const shown = state.status === "ready" ? state.stats : state.status === "loading" ? last : null;
  const regions = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);

  const data = useMemo((): ScreenStats | null => {
    if (!shown) return null;
    const blocks = new Map(doc.blocks.map((block) => [block.id, block]));
    return {
      sample: false,
      range: shown.range,
      from: shown.from,
      to: shown.to,
      days: shown.days,
      totals: shown.totals,
      previous: shown.previous,
      links: shown.blocks.map((item) => {
        const block = blocks.get(item.key);
        return { key: item.key, label: block ? label(block) : t("removedBlock"), clicks: item.count };
      }),
      sources: asShares(shown.referrers, (key) => (t.has(`sourceNames.${key}`) ? t(`sourceNames.${key}` as "sourceNames.other") : t("sourceNames.other"))),
      countries: asShares(shown.countries, (key) => regions.of(key) ?? key),
      devices: asShares(shown.devices, (key) => (t.has(`deviceNames.${key}`) ? t(`deviceNames.${key}` as "deviceNames.mobile") : key)),
    };
  }, [shown, doc.blocks, label, t, regions]);

  if (state.status === "off") return <AnalyticsEmpty />;
  if (state.status === "error" && !data)
    return (
      <Screen title={t("title")} wide lead={t("leadLive")}>
        <Notice icon={icons.warning} title={t("error.title")} body={t("error.body")}>
          <Button onClick={() => reloadLiveStats(account.id, range)}>{t("retry")}</Button>
        </Notice>
      </Screen>
    );
  if (data && shown?.since === null)
    return (
      <Screen title={t("title")} wide lead={t("leadLive")}>
        <Notice icon={icons.analytics} title={t("nothingYet.title")} body={t("nothingYet.body")} />
        <p className="flex items-start gap-2 text-small font-regular text-fg-secondary">
          <Icon icon={icons.info} size="sm" className="mt-0.5 shrink-0" />
          {t("privacy")}
        </p>
      </Screen>
    );
  return <StatsView data={data} range={range} onRange={setRange} busy={state.status === "loading"} />;
}

function SampleAnalytics() {
  const t = useTranslations("app.analytics");
  const locale = useLocale();
  const { account, doc, label } = useSite();
  const [range, setRange] = useState<StatsRange>(30);
  const regions = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
  const data = useMemo((): ScreenStats => {
    const stats = sampleStats(account.username, doc.blocks, range);
    const sum = sampleTotals(stats.days);
    return {
      sample: true,
      range,
      from: stats.days[0]?.date ?? "",
      to: stats.days.at(-1)?.date ?? "",
      days: stats.days.map((day) => ({ date: day.date, views: day.views, visitors: null, clicks: day.clicks })),
      totals: { views: sum.views, visitors: null, clicks: sum.clicks },
      previous: { views: stats.previous.views, visitors: null, clicks: stats.previous.clicks },
      links: stats.links.map(({ block, clicks }) => ({ key: block.id, label: label(block), clicks })),
      sources: stats.sources.map((source) => ({ key: source.key, label: t(`sourceNames.${source.key}` as "sourceNames.other"), share: source.share })),
      countries: stats.countries.map((country) => ({ key: country.code, label: regions.of(country.code) ?? country.code, share: country.share })),
      devices: stats.devices.map((device) => ({ key: device.key, label: t(`deviceNames.${device.key}`), share: device.share })),
    };
  }, [account.username, doc.blocks, range, label, t, regions]);
  return <StatsView data={data} range={range} onRange={setRange} busy={false} />;
}

/** The change against the period before, as KpiTile shows it (arrow, signed text, words). */
function useDelta(range: StatsRange) {
  const t = useTranslations("app.analytics");
  const tKpi = useTranslations("ui.kpi");
  const locale = useLocale();
  return (now: number, before: number | null | undefined): KpiDelta | undefined => {
    // Nothing to compare with (or nothing before): no change is made up.
    if (before === null || before === undefined || before <= 0) return undefined;
    const change = now / before - 1;
    const rounded = Math.round(change * 100);
    return {
      change: rounded,
      text: new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" }).format(rounded / 100),
      label: rounded > 0 ? tKpi("up") : rounded < 0 ? tKpi("down") : tKpi("flat"),
      context: t("vsPrevious", { days: String(range) }),
    };
  };
}

/** Saves the days on screen as a CSV file. */
function downloadCsv(text: string, name: string) {
  const link = document.createElement("a");
  // A byte order mark first, so spreadsheet apps read the file as UTF-8.
  link.href = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff), text], { type: "text/csv;charset=utf-8" }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function StatsView({ data, range, onRange, busy }: { data: ScreenStats | null; range: StatsRange; onRange: (range: StatsRange) => void; busy: boolean }) {
  const t = useTranslations("app.analytics");
  const locale = useLocale();
  const delta = useDelta(data?.range ?? range);
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  const percent = (n: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: n < 0.1 ? 1 : 0 }).format(n);
  const ctr = (views: number, clicks: number) => (views ? clicks / views : 0);
  const loading = data === null;
  const visitors = data ? data.totals.visitors !== null : true;
  const top = data?.links[0];
  const grouped = "group-data-[grouped]/app:bg-group max-lg:group-data-[grouped]/app:border-transparent";

  const tiles = data
    ? [
        { key: "views", label: t("views"), value: number(data.totals.views), delta: delta(data.totals.views, data.previous?.views) },
        ...(data.totals.visitors !== null
          ? [{ key: "visitors", label: t("visitors"), value: number(data.totals.visitors), delta: delta(data.totals.visitors, data.previous?.visitors) }]
          : []),
        { key: "clicks", label: t("clicks"), value: number(data.totals.clicks), delta: delta(data.totals.clicks, data.previous?.clicks) },
        {
          key: "ctr",
          label: t("ctr"),
          value: percent(ctr(data.totals.views, data.totals.clicks)),
          delta: data.previous ? delta(ctr(data.totals.views, data.totals.clicks), ctr(data.previous.views, data.previous.clicks)) : undefined,
        },
      ]
    : ["views", "visitors", "clicks", "ctr"].map((key) => ({ key, label: t(key as "views"), value: "", delta: undefined }));

  const exportCsv = () => {
    if (!data) return;
    const csv = statsCsv(data.days, { date: t("date"), views: t("views"), visitors: t("visitors"), clicks: t("clicks") }, data.totals.visitors !== null);
    downloadCsv(csv, t(data.sample ? "csvFileSample" : "csvFile", { from: data.from, to: data.to }));
  };

  return (
    <Screen
      title={t("title")}
      wide
      // Said once, next to the title: every number on this screen is a sample in the demo.
      actions={
        data?.sample ? (
          <Badge size="sm" tone="outline">
            {t("sample")}
          </Badge>
        ) : undefined
      }
      lead={data?.sample ? t("lead") : t("leadLive")}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Full width on phones, like an iOS segmented control; its natural width from sm up. It sits on
            the tinted ground, so its track takes the next tint step to stay visible as a control. */}
        <Segmented<`${StatsRange}`>
          label={t("range")}
          value={`${range}`}
          onValueChange={(value) => onRange(Number(value) as StatsRange)}
          className="w-full bg-tinted *:flex-1 pointer-coarse:h-control-lg sm:w-auto sm:*:flex-none"
          options={STATS_RANGES.map((value) => ({ value: `${value}` as const, label: t("days", { days: String(value) }) }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-2" aria-busy={busy || loading}>
        {loading ? (
          <p role="status" className="sr-only">
            {t("loading")}
          </p>
        ) : null}
        <dl className={cn("grid grid-cols-2 gap-2 sm:gap-3", tiles.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3 max-lg:[&>:last-child:nth-child(odd)]:col-span-2")}>
          {tiles.map((tile) => (
            <KpiTile key={tile.key} label={tile.label} value={tile.value} delta={tile.delta} loading={loading} className={cn("p-3 sm:p-4", grouped)} />
          ))}
        </dl>
        {/* The screen's question ("is my page working?") answered in one sentence, before the chart.
            The title is isolated, so a Latin title in an Arabic sentence (or the other way) keeps its order. */}
        {top && top.clicks > 0 ? <p className="text-small font-regular text-fg">{t("topInsight", { title: `\u2068${top.label}\u2069` })}</p> : null}
      </div>

      {data ? (
        <>
          <Panel
            title={t("viewsPerDay")}
            id="views-chart-title"
            action={
              <Button size="sm" variant="ghost" icon={icons.download} onClick={exportCsv}>
                {t.rich("csv", { bdi })}
              </Button>
            }
          >
            <ViewsChart days={data.days} label={t("viewsPerDay")} visitors={visitors} />
          </Panel>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title={t("topLinks")} id="top-links-title">
              <BarList
                empty={t("noLinks")}
                items={data.links.slice(0, 8).map((item) => ({ key: item.key, label: item.label, value: number(item.clicks), share: item.clicks }))}
              />
            </Panel>
            <Panel title={t("sources")} id="sources-title">
              <BarList empty={t("noData")} items={data.sources.map((item) => ({ ...item, value: percent(item.share) }))} />
            </Panel>
            <Panel title={t("countries")} id="countries-title">
              <BarList empty={t("noData")} items={data.countries.map((item) => ({ ...item, value: percent(item.share) }))} />
            </Panel>
            <Panel title={t("devices")} id="devices-title">
              <BarList empty={t("noData")} items={data.devices.map((item) => ({ ...item, value: percent(item.share) }))} />
            </Panel>
          </div>
        </>
      ) : null}

      {/* A footnote on the ground, on the column's edge like the lead at the top (a box in the ground's own fill only indented it). */}
      <div className="grid gap-2 text-small font-regular text-fg-secondary">
        <p className="flex items-start gap-2">
          <Icon icon={icons.info} size="sm" className="mt-0.5 shrink-0" />
          {t("privacy")}
        </p>
        {visitors && !data?.sample ? <p className="ps-6">{t("visitorsNote")}</p> : null}
      </div>
    </Screen>
  );
}
