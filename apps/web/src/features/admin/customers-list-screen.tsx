"use client";

import { tokens } from "@linkyo/tokens";
import { ActiveFilters, Avatar, Badge, Button, DataList, FilterChip, FilterGroup, FilterSheet, Icon, icons, Select, TextField, toast, type ActiveFilter } from "@linkyo/ui";
import { ArrowLeft, EyeOff, UsersRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Screen } from "@/features/app/screen";
import { useMediaQuery } from "@/features/app/use-media-query";
import { Link } from "@/i18n/navigation";

import { useConsoleActions } from "./actions";
import { bdi, isolate } from "./bidi";
import { useCustomers } from "./customers/data";
import { hasProForLife, monthlyRevenue, type Customer } from "./customers/model";
import { customersCsv } from "./customers/stats";
import { DemoNote, PlanBadge, StatusBadges } from "./customers/ui";
import { count, country, date, money, PAGE_SIZE, timeAgo } from "./format";
import { useAdmin } from "./session";

const STATUSES = ["active", "trialing", "past_due", "canceled", "suspended", "device"] as const;
type Status = (typeof STATUSES)[number];
const PLANS = ["free", "pro"] as const;
type PlanFilter = (typeof PLANS)[number];
// Views sort only where they are measured (the demo's sample customers).
/** The orders of the list; by views only where views are measured (`viewsMeasured`). */
const SORTS = ["newest", "lastSeen", "revenue", "views"] as const;
type Sort = (typeof SORTS)[number];

const matchesStatus = (customer: Customer, status: Status) => {
  if (status === "suspended") return customer.status === "suspended";
  if (status === "device") return customer.source === "device";
  return customer.subscription.status === status;
};

/** Pro for life from invites: a reward beside the plan (the plan stays Free, it is never revenue). */
function ProForLifeBadge({ customer }: { customer: Customer }) {
  const t = useTranslations("admin.customers");
  return hasProForLife(customer) ? (
    <Badge size="sm" tone="outline">
      {t.rich("proForLife", { bdi })}
    </Badge>
  ) : null;
}

/**
 * For roles without `customers.view` (editors): customers and their e-mail addresses stay hidden,
 * also when the address is typed in directly.
 */
export function CustomersHidden() {
  const t = useTranslations("admin.customers");
  return (
    <Screen title={t("noAccessTitle")} lead={t("noAccessLead")}>
      <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-line-strong p-8 text-center">
        <Icon icon={EyeOff} size="lg" className="text-fg-tertiary" />
        <Button asChild icon={ArrowLeft}>
          <Link href="/admin">{t("toOverview")}</Link>
        </Button>
      </div>
    </Screen>
  );
}

/** Every customer: search, filter, sort, open one; export what you see as CSV (owners and admins, logged). */
export function CustomersListScreen() {
  const { can } = useAdmin();
  return can("customers.view") ? <CustomersList /> : <CustomersHidden />;
}

/** Turns one value on or off in a set. */
const toggled = <T,>(set: ReadonlySet<T>, value: T): Set<T> => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

/**
 * Phones first (A-11): the search stays at the top while the list scrolls, the filters sit behind one
 * button in a sheet (chips for plan and status, a select for the country and the order), the filters
 * that are on show as removable chips, and the customers are readable cards that line up as columns
 * from md. 25 per page.
 */
function CustomersList() {
  const t = useTranslations("admin.customers");
  const ui = useTranslations("ui");
  const locale = useLocale();
  const params = useSearchParams();
  const { can } = useAdmin();
  const actions = useConsoleActions();
  const { customers, now, ready, viewsMeasured } = useCustomers();
  const sorts = SORTS.filter((value) => value !== "views" || viewsMeasured);
  const initialStatus = STATUSES.find((status) => status === params.get("status"));
  const [query, setQuery] = useState("");
  const [plans, setPlans] = useState<ReadonlySet<PlanFilter>>(new Set());
  const [statuses, setStatuses] = useState<ReadonlySet<Status>>(new Set(initialStatus ? [initialStatus] : []));
  const [place, setPlace] = useState("");
  const [chosenSort, setSort] = useState<Sort>("newest");
  // Views stop being an order where they are not measured (a database without the statistics).
  const sort: Sort = chosenSort === "views" && !viewsMeasured ? "newest" : chosenSort;
  const [page, setPage] = useState(0);
  const unknown = t("unknownCountry");
  // A phone's card shows what tells customers apart at a glance; from md every column has room.
  const wide = useMediaQuery(`(width >= ${String(tokens.breakpoint.md / 16)}rem)`);

  const countries = useMemo(
    () => [...new Set(customers.map((customer) => customer.country).filter(Boolean))].sort((a, b) => country(a, locale, unknown).localeCompare(country(b, locale, unknown), locale)),
    [customers, locale, unknown],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = customers.filter(
      (customer) =>
        (plans.size === 0 || plans.has(customer.subscription.plan)) &&
        (statuses.size === 0 || [...statuses].some((status) => matchesStatus(customer, status))) &&
        (!place || customer.country === place) &&
        (!needle ||
          customer.name.toLowerCase().includes(needle) ||
          (customer.email ?? "").includes(needle) ||
          customer.username.includes(needle) ||
          customer.logins.some((login) => login.ip.startsWith(needle))),
    );
    const by: Record<Sort, (a: Customer, b: Customer) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      lastSeen: (a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt),
      revenue: (a, b) => monthlyRevenue(b, now) - monthlyRevenue(a, now) || b.createdAt.localeCompare(a.createdAt),
      views: (a, b) => b.usage.views30 - a.usage.views30,
    };
    return list.sort(by[sort]);
  }, [customers, query, plans, statuses, place, sort, now]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  // Any change of the filters starts at the first page again.
  const changed =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(0);
    };
  const planLabel = (plan: PlanFilter) => (plan === "pro" ? "Pro" : t("plans.free"));
  const active: ActiveFilter[] = [
    ...[...plans].map((plan) => ({ key: `plan:${plan}`, label: planLabel(plan), onRemove: () => changed(setPlans)(toggled(plans, plan)) })),
    ...[...statuses].map((status) => ({ key: `status:${status}`, label: t(`filters.${status}`), onRemove: () => changed(setStatuses)(toggled(statuses, status)) })),
    ...(place ? [{ key: `country:${place}`, label: country(place, locale, unknown), onRemove: () => changed(setPlace)("") }] : []),
  ];
  const clear = () => {
    setPlans(new Set());
    setStatuses(new Set());
    setPlace("");
    setPage(0);
  };

  /** Logged first (who exported how many rows); no log, no file. Cells a spreadsheet would run stay text. */
  const exportCsv = async () => {
    if (!(await actions.exported(filtered.length))) {
      toast({ title: t("exportFailed"), tone: "danger" });
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([customersCsv(filtered, now, { views: viewsMeasured })], { type: "text/csv" }));
    link.download = "linkyo-customers.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  return (
    <Screen
      title={t("title")}
      lead={t.rich("lead", { bdi })}
      wide
      actions={
        can("customers.export") ? (
          <Button icon={icons.download} onClick={() => void exportCsv()} disabled={!filtered.length}>
            {t.rich("export", { bdi })}
          </Button>
        ) : null
      }
    >
      {/* Flush under the phone's header (top-16) on a solid band; at the top of the window on laptops. */}
      <div data-customer-search className="layer-sticky sticky top-16 -mx-4 -mt-2 grid grid-cols-1 gap-3 bg-canvas px-4 py-2 md:-mx-8 md:px-8 lg:top-0">
        <div className="flex items-end gap-2">
          <TextField
            label={t("search")}
            hideLabel
            icon={icons.search}
            value={query}
            onChange={(event) => changed(setQuery)(event.target.value)}
            placeholder={t.markup("searchHint", { bdi: isolate })}
            type="search"
            autoComplete="off"
            className="min-w-0 flex-1"
          />
          <FilterSheet
            title={ui("filter.title")}
            activeCount={active.length}
            activeLabel={(value) => ui("filter.active", { count: value })}
            resetLabel={ui("filter.reset")}
            doneLabel={t("showResults", { count: filtered.length })}
            closeLabel={ui("filter.close")}
            onReset={clear}
            className="shrink-0"
          >
            <FilterGroup legend={t("plan")}>
              {PLANS.map((plan) => (
                <FilterChip key={plan} label={planLabel(plan)} selected={plans.has(plan)} onToggle={() => changed(setPlans)(toggled(plans, plan))} />
              ))}
            </FilterGroup>
            <FilterGroup legend={t("status")}>
              {STATUSES.map((status) => (
                <FilterChip key={status} label={t(`filters.${status}`)} selected={statuses.has(status)} onToggle={() => changed(setStatuses)(toggled(statuses, status))} />
              ))}
            </FilterGroup>
            <Select
              label={t("country")}
              value={place}
              onValueChange={changed(setPlace)}
              placeholder={t("all")}
              options={countries.map((code) => ({ value: code, label: country(code, locale, unknown) }))}
              size="auto"
            />
            <Select label={t("sort")} value={sort} onValueChange={changed(setSort)} options={sorts.map((value) => ({ value, label: t(`sorts.${value}`) }))} size="auto" />
          </FilterSheet>
        </div>
        <ActiveFilters label={ui("filter.activeList")} filters={active} removeLabel={(filter) => ui("filter.remove", { filter })} clearLabel={ui("filter.clear")} onClear={clear} />
      </div>

      <p role="status" className="-mt-3 text-small text-fg-secondary">
        {ready ? t("results", { count: filtered.length }) : ""}
        {ready && sort !== "newest" ? <span className="text-fg-tertiary"> · {t(`sorts.${sort}`)}</span> : null}
      </p>

      {ready && filtered.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-xl border border-dashed border-line-strong p-8 text-center">
          <Icon icon={UsersRound} size="lg" className="text-fg-tertiary" />
          <p className="text-body text-fg-secondary">{t("empty")}</p>
        </div>
      ) : null}

      {shown.length > 0 ? (
        <DataList
          label={t("title")}
          linkAs={Link}
          items={shown.map((customer) => ({
            id: customer.id,
            href: `/admin/customers/${customer.id}`,
            title: <bdi>{customer.name}</bdi>,
            // The address truncates itself, left to right: in Arabic the ellipsis then falls at its end
            // ("mila.k…"), not at the line's end, which would cut off its start ("…ample.com").
            subtitle: customer.email ? (
              <span dir="ltr" className="block truncate text-start rtl:text-end">
                {customer.email}
              </span>
            ) : undefined,
            leading: <Avatar name={customer.name} size="sm" />,
            trailing: (
              <span className="flex flex-wrap justify-end gap-1">
                <PlanBadge customer={customer} />
                <ProForLifeBadge customer={customer} />
              </span>
            ),
            fields: [
              { label: t("columns.status"), value: customer.subscription.status || customer.status === "suspended" || customer.source === "device" ? <StatusBadges customer={customer} /> : "–" },
              { label: t("columns.country"), value: country(customer.country, locale, unknown) },
              ...(wide ? [{ label: t("columns.since"), value: date(customer.createdAt, locale) }] : []),
              { label: t("columns.lastSeen"), value: timeAgo(customer.lastSeenAt, now, locale) },
              ...(viewsMeasured && (wide || !can("billing.view")) ? [{ label: t.markup("columns.views", { bdi: isolate }), value: count(customer.usage.views30, locale), numeric: true }] : []),
              ...(can("billing.view") ? [{ label: t.markup("columns.mrr", { bdi: isolate }), value: money(monthlyRevenue(customer, now), locale), numeric: true }] : []),
            ],
          }))}
          footer={
            pages > 1 ? (
              <nav aria-label={t("pagination")} className="flex w-full items-center justify-between gap-3">
                <Button icon={icons.previous} disabled={current === 0} onClick={() => setPage(current - 1)}>
                  {t("previous")}
                </Button>
                <span className="text-small text-fg-secondary tabular-nums">{t("page", { page: current + 1, pages })}</span>
                <Button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} trailing={<Icon icon={icons.next} size="sm" />}>
                  {t("next")}
                </Button>
              </nav>
            ) : null
          }
        />
      ) : null}
      <DemoNote />
    </Screen>
  );
}
