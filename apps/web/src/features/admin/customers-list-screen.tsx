"use client";

import { Avatar, Button, Icon, TextField } from "@linkyo/ui";
import { ChevronLeft, ChevronRight, Download, Search, UsersRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState, type ReactNode } from "react";

import { Screen } from "@/features/app/screen";
import { Link } from "@/i18n/navigation";

import { useCustomers } from "./customers/data";
import { monthlyRevenue, type Customer } from "./customers/model";
import { DemoNote, PlanBadge, StatusBadges } from "./customers/ui";
import { count, country, date, money, timeAgo } from "./format";
import { useAdmin } from "./session";

const STATUS = ["all", "active", "trialing", "past_due", "canceled", "suspended", "device"] as const;
type StatusFilter = (typeof STATUS)[number];
const SORTS = ["newest", "lastSeen", "revenue", "views"] as const;
type Sort = (typeof SORTS)[number];
const PAGE = 25;

const matchesStatus = (customer: Customer, status: StatusFilter) => {
  if (status === "all") return true;
  if (status === "suspended") return customer.status === "suspended";
  if (status === "device") return customer.source === "device";
  return customer.subscription.status === status;
};

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="text-caption text-fg-secondary font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-control-md border-line-input bg-surface-elevated text-small text-fg hover:border-fg-tertiary focus-visible:border-focus focus-visible:focus-ring min-w-0 rounded-md border px-3 outline-none"
      >
        {children}
      </select>
    </div>
  );
}

/** Every customer: search, filter, sort, open one; export what you see as CSV. */
export function CustomersListScreen() {
  const t = useTranslations("admin.customers");
  const locale = useLocale();
  const params = useSearchParams();
  const { can } = useAdmin();
  const { customers, now, ready } = useCustomers();
  const initialStatus = STATUS.find((status) => status === params.get("status")) ?? "all";
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState<"all" | "free" | "pro">("all");
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [place, setPlace] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(0);
  const unknown = t("unknownCountry");

  const countries = useMemo(
    () =>
      [...new Set(customers.map((customer) => customer.country).filter(Boolean))].sort((a, b) =>
        country(a, locale, unknown).localeCompare(country(b, locale, unknown), locale),
      ),
    [customers, locale, unknown],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = customers.filter(
      (customer) =>
        (plan === "all" || customer.subscription.plan === plan) &&
        matchesStatus(customer, status) &&
        (place === "all" || customer.country === place) &&
        (!needle ||
          customer.name.toLowerCase().includes(needle) ||
          customer.email.includes(needle) ||
          customer.username.includes(needle) ||
          customer.logins.some((login) => login.ip.startsWith(needle))),
    );
    const by: Record<Sort, (a: Customer, b: Customer) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      lastSeen: (a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt),
      revenue: (a, b) => monthlyRevenue(b) - monthlyRevenue(a) || b.createdAt.localeCompare(a.createdAt),
      views: (a, b) => b.usage.views30 - a.usage.views30,
    };
    return list.sort(by[sort]);
  }, [customers, query, plan, status, place, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * PAGE, current * PAGE + PAGE);
  const reset =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(0);
    };

  const exportCsv = () => {
    const header = [
      "name",
      "email",
      "username",
      "plan",
      "subscription",
      "status",
      "country",
      "created",
      "last_seen",
      "mrr_eur",
      "views_30d",
    ];
    const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const lines = filtered.map((customer) =>
      [
        customer.name,
        customer.email,
        customer.username,
        customer.subscription.plan,
        customer.subscription.status ?? "",
        customer.status,
        customer.country,
        customer.createdAt,
        customer.lastSeenAt,
        (monthlyRevenue(customer) / 100).toFixed(2),
        customer.usage.views30,
      ]
        .map(cell)
        .join(","),
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" }),
    );
    link.download = "linkyo-customers.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  return (
    <Screen
      title={t("title")}
      lead={t("lead")}
      wide
      actions={
        <Button icon={Download} onClick={exportCsv} disabled={!filtered.length}>
          {t("export")}
        </Button>
      }
    >
      <div className="border-line bg-surface shadow-e1 grid grid-cols-1 gap-3 rounded-xl border p-4 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] md:items-end">
        <TextField
          label={t("search")}
          icon={Search}
          value={query}
          onChange={(event) => reset(setQuery)(event.target.value)}
          placeholder={t("searchHint")}
          type="search"
        />
        <Select label={t("plan")} value={plan} onChange={(value) => reset(setPlan)(value as typeof plan)}>
          <option value="all">{t("all")}</option>
          <option value="free">{t("plans.free")}</option>
          <option value="pro">Pro</option>
        </Select>
        <Select
          label={t("status")}
          value={status}
          onChange={(value) => reset(setStatus)(value as StatusFilter)}
        >
          {STATUS.map((option) => (
            <option key={option} value={option}>
              {t(`filters.${option}`)}
            </option>
          ))}
        </Select>
        <Select label={t("country")} value={place} onChange={reset(setPlace)}>
          <option value="all">{t("all")}</option>
          {countries.map((code) => (
            <option key={code} value={code}>
              {country(code, locale, unknown)}
            </option>
          ))}
        </Select>
        <Select label={t("sort")} value={sort} onChange={(value) => reset(setSort)(value as Sort)}>
          {SORTS.map((option) => (
            <option key={option} value={option}>
              {t(`sorts.${option}`)}
            </option>
          ))}
        </Select>
      </div>

      <p role="status" className="text-small text-fg-secondary">
        {ready ? t("results", { count: filtered.length }) : ""}
      </p>

      {ready && filtered.length === 0 ? (
        <div className="border-line-strong grid justify-items-center gap-3 rounded-xl border border-dashed p-8 text-center">
          <Icon icon={UsersRound} size="lg" className="text-fg-tertiary" />
          <p className="text-body text-fg-secondary">{t("empty")}</p>
        </div>
      ) : null}

      {shown.length > 0 ? (
        <>
          {/* Wide screens: a table. */}
          <div className="border-line bg-surface shadow-e1 hidden overflow-hidden rounded-xl border md:block">
            <table className="text-small w-full">
              <caption className="sr-only">{t("title")}</caption>
              <thead className="bg-canvas-muted text-caption text-fg-secondary">
                <tr>
                  <th scope="col" className="px-4 py-2 text-start font-medium">
                    {t("columns.customer")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    {t("columns.plan")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    {t("columns.country")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    {t("columns.since")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    {t("columns.lastSeen")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-end font-medium">
                    {t("columns.views")}
                  </th>
                  {can("billing.view") ? (
                    <th scope="col" className="px-4 py-2 text-end font-medium">
                      {t("columns.mrr")}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {shown.map((customer) => (
                  <tr key={customer.id} className="border-line hover:bg-hover border-t">
                    <th scope="row" className="font-regular px-4 py-2 text-start">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="focus-visible:focus-ring flex min-w-0 items-center gap-3 rounded-sm"
                      >
                        <Avatar name={customer.name} size="sm" />
                        <span className="grid min-w-0">
                          <span className="truncate font-medium">{customer.name}</span>
                          <span dir="ltr" className="text-caption text-fg-tertiary truncate text-start">
                            {customer.email}
                          </span>
                        </span>
                      </Link>
                    </th>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap items-center gap-1">
                        <PlanBadge customer={customer} />
                        <StatusBadges customer={customer} />
                      </span>
                    </td>
                    <td className="text-fg-secondary px-3 py-2">
                      {country(customer.country, locale, unknown)}
                    </td>
                    <td className="text-fg-secondary px-3 py-2 whitespace-nowrap">
                      {date(customer.createdAt, locale)}
                    </td>
                    <td className="text-fg-secondary px-3 py-2 whitespace-nowrap">
                      {timeAgo(customer.lastSeenAt, now, locale)}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {count(customer.usage.views30, locale)}
                    </td>
                    {can("billing.view") ? (
                      <td className="px-4 py-2 text-end tabular-nums">
                        {money(monthlyRevenue(customer), locale)}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Phones: one card per customer. */}
          <ul className="grid grid-cols-1 gap-2 md:hidden">
            {shown.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="border-line bg-surface shadow-e1 focus-visible:focus-ring grid gap-2 rounded-xl border p-3"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={customer.name} size="sm" />
                    <span className="grid min-w-0 flex-1">
                      <span className="text-small truncate font-medium">{customer.name}</span>
                      <span dir="ltr" className="text-caption text-fg-tertiary truncate text-start">
                        {customer.email}
                      </span>
                    </span>
                    <PlanBadge customer={customer} />
                  </span>
                  <span className="text-caption text-fg-secondary flex flex-wrap items-center justify-between gap-2">
                    <StatusBadges customer={customer} />
                    <span>
                      {country(customer.country, locale, unknown)} ·{" "}
                      {timeAgo(customer.lastSeenAt, now, locale)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3">
            <Button
              icon={ChevronLeft}
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              className="[&_svg]:rtl:-scale-x-100"
            >
              {t("previous")}
            </Button>
            <span className="text-small text-fg-secondary tabular-nums">
              {t("page", { page: current + 1, pages })}
            </span>
            <Button
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              trailing={<Icon icon={ChevronRight} size="sm" className="rtl:-scale-x-100" />}
            >
              {t("next")}
            </Button>
          </nav>
        </>
      ) : null}
      <DemoNote />
    </Screen>
  );
}
