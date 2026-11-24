"use client";

import {
  ActiveFilters,
  Avatar,
  Badge,
  Button,
  ChartTable,
  CommandPalette,
  DataList,
  FilterChip,
  FilterGroup,
  FilterSheet,
  icons,
  KpiTile,
  Segmented,
  Select,
  toast,
  type PaletteCommand,
} from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";

import { Specimen, SubSection } from "./section";

const ROLES = ["owner", "admin", "editor", "support"] as const;
type Role = (typeof ROLES)[number];
const STATUSES = ["all", "active", "blocked"] as const;
type Status = (typeof STATUSES)[number];
/** Sample counts for the segmented control (the subsection says the data is a sample). */
const STATUS_COUNTS: Record<Status, number> = { all: 1280, active: 1243, blocked: 37 };
const PLANS = ["free", "pro"] as const;
type Plan = (typeof PLANS)[number];
/** Languages by their own names, so each is read in its own voice. */
const LANGUAGES = [
  { value: "de", label: "Deutsch", lang: "de" },
  { value: "en", label: "English", lang: "en" },
  { value: "ar", label: "العربية", lang: "ar" },
] as const;
/** Sample weekly views for the figures (week number, views). */
const WEEKS = [
  { week: 38, views: 410 },
  { week: 39, views: 455 },
  { week: 40, views: 430 },
  { week: 41, views: 520 },
  { week: 42, views: 610 },
  { week: 43, views: 580 },
  { week: 44, views: 640 },
  { week: 45, views: 720 },
] as const;

const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;

/** Select, Segmented with counts, and filters behind one button (ControlsSection). */
export function SelectionKit() {
  const t = useTranslations("design.kit");
  const ui = useTranslations("ui");
  const locale = useLocale();
  const [role, setRole] = useState<Role | "">("");
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]["value"]>("de");
  const [status, setStatus] = useState<Status>("all");
  const [plans, setPlans] = useState<ReadonlySet<Plan>>(new Set<Plan>(["pro"]));
  const toggle = (plan: Plan) =>
    setPlans((current) => {
      const next = new Set(current);
      if (next.has(plan)) next.delete(plan);
      else next.add(plan);
      return next;
    });
  return (
    <SubSection title={t("selection")} note={t("selectionNote")}>
      <div className="grid gap-6 md:grid-cols-2" data-testid="kit-selects">
        <Select
          label={t("role")}
          hint={t("roleHint")}
          placeholder={t("allRoles")}
          value={role}
          onValueChange={setRole}
          options={ROLES.map((value) => ({ value, label: t(`roles.${value}`) }))}
          size="auto"
        />
        <Select label={t("language")} value={language} onValueChange={setLanguage} options={LANGUAGES} size="auto" />
      </div>
      <Specimen>
        <Segmented
          label={t("status")}
          value={status}
          onValueChange={setStatus}
          options={STATUSES.map((value) => ({ value, label: t(`statuses.${value}`), count: STATUS_COUNTS[value] }))}
          formatCount={(count) => count.toLocaleString(locale)}
        />
        <FilterSheet
          title={ui("filter.title")}
          activeCount={plans.size}
          activeLabel={(count) => ui("filter.active", { count })}
          resetLabel={ui("filter.reset")}
          doneLabel={ui("filter.done")}
          closeLabel={ui("filter.close")}
          onReset={() => setPlans(new Set())}
        >
          <FilterGroup legend={t("plan")}>
            {PLANS.map((plan) => (
              <FilterChip key={plan} label={t(`plans.${plan}`)} selected={plans.has(plan)} onToggle={() => toggle(plan)} />
            ))}
          </FilterGroup>
        </FilterSheet>
        <ActiveFilters
          label={ui("filter.activeList")}
          filters={[...plans].map((plan) => ({ key: plan, label: t(`plans.${plan}`), onRemove: () => toggle(plan) }))}
          removeLabel={(filter) => ui("filter.remove", { filter })}
          clearLabel={ui("filter.clear")}
          onClear={() => setPlans(new Set())}
        />
      </Specimen>
    </SubSection>
  );
}

/** Key figures, the table behind a chart, a list of records and the command palette (StatesSection). */
export function DataKit() {
  const t = useTranslations("design.kit");
  const ui = useTranslations("ui");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const number = (value: number) => value.toLocaleString(locale);
  const percent = (value: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" }).format(value);
  const month = (iso: string) => new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
  const commands = useMemo<PaletteCommand[]>(() => {
    const ran = (label: string) => () => toast({ title: t("ran", { command: label }) });
    const command = (id: "overview" | "customers" | "security" | "export" | "invite", group: "pages" | "actions", icon: (typeof icons)[keyof typeof icons], hint?: string): PaletteCommand => {
      const label = t(`commands.${id}`);
      return { id, label, group: t(`paletteGroups.${group}`), icon, hint, onSelect: ran(label) };
    };
    return [
      command("overview", "pages", icons.home),
      command("customers", "pages", icons.customers),
      command("security", "pages", icons.security),
      command("export", "actions", icons.download),
      command("invite", "actions", icons.invite),
    ];
  }, [t]);

  return (
    <>
      <SubSection title={t("figures")} note={t("figuresNote")}>
        <dl className="grid gap-3 sm:grid-cols-3" data-testid="kit-kpis">
          <KpiTile
            label={t("views")}
            value={number(4820)}
            delta={{ change: 0.12, text: percent(0.12), label: ui("kpi.up"), context: t("vsLastMonth") }}
            trend={WEEKS.map((week) => week.views)}
            trendLabel={t("lastWeeks")}
          />
          <KpiTile
            label={t("clicks")}
            value={number(612)}
            delta={{ change: -0.04, text: percent(-0.04), label: ui("kpi.down"), context: t("vsLastMonth") }}
            trend={[90, 84, 88, 80, 79, 76, 74, 72]}
            trendLabel={t("lastWeeks")}
          />
          <KpiTile label={t("signups")} value={number(38)} delta={{ change: 0, text: percent(0), label: ui("kpi.flat"), context: t("vsLastMonth") }} />
        </dl>
        <ChartTable
          caption={t("viewsPerWeek")}
          columns={[
            { key: "week", label: t("week"), cell: (row: (typeof WEEKS)[number]) => <bdi>{number(row.week)}</bdi> },
            { key: "views", label: t("views"), numeric: true, cell: (row: (typeof WEEKS)[number]) => number(row.views) },
          ]}
          rows={WEEKS}
          rowKey={(row) => String(row.week)}
          showLabel={ui("chartTable.show")}
          hideLabel={ui("chartTable.hide")}
        />
      </SubSection>
      <SubSection title={t("list")} note={t("listNote")}>
        <DataList
          label={t("customers")}
          items={[
            {
              id: "mila",
              title: "Mila Aurel",
              subtitle: <bdi dir="ltr">linkyo.app/milaaurel</bdi>,
              leading: <Avatar name="Mila Aurel" size="sm" />,
              fields: [
                { label: t("plan"), value: t("plans.pro") },
                { label: t("pages"), value: number(3), numeric: true },
                { label: t("since"), value: month("2025-03-01") },
              ],
              onSelect: () => toast({ title: "Mila Aurel" }),
            },
            {
              id: "noor",
              title: "Noor Haddad",
              subtitle: <bdi dir="ltr">linkyo.app/noor</bdi>,
              leading: <Avatar name="Noor Haddad" size="sm" />,
              fields: [
                { label: t("plan"), value: t("plans.free") },
                { label: t("pages"), value: number(1), numeric: true },
                { label: t("since"), value: month("2026-10-01") },
              ],
              trailing: <Badge tone="primary">{t("newBadge")}</Badge>,
            },
          ]}
        />
      </SubSection>
      <SubSection title={t("palette")} note={t.rich("paletteNote", { bdi })}>
        <Specimen>
          <Button icon={icons.search} onClick={() => setOpen(true)}>
            {t("openPalette")}
          </Button>
        </Specimen>
        <CommandPalette
          open={open}
          onOpenChange={setOpen}
          commands={commands}
          label={ui("palette.label")}
          placeholder={ui("palette.placeholder")}
          emptyLabel={ui("palette.empty")}
          resultsLabel={(count) => ui("palette.results", { count })}
        />
      </SubSection>
    </>
  );
}
