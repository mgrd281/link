"use client";

import { Badge, Button, cn, ConfirmDialog, Icon, icons, KpiTile, Segmented, TextField, toast } from "@linkyo/ui";
import { KeyRound, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import type { LoginEvent } from "@/features/account/types";
import { Screen } from "@/features/app/screen";
import { Link } from "@/i18n/navigation";

import { useConsoleActions } from "./actions";
import { bdi, isolate, ltr } from "./bidi";
import { useCustomers } from "./customers/data";
import { daysAgo, riskFlags, type Customer, type RiskFlag } from "./customers/model";
import { BlockButton, DemoNote, DeviceGlyph, DeviceLabel, RiskBadges } from "./customers/ui";
import { count, country, dateTime, PAGE_SIZE, timeAgo } from "./format";
import { useAdmin } from "./session";

type Pane = "all" | "failed" | "risky" | "blocked";
const PANES: readonly Pane[] = ["all", "failed", "risky", "blocked"];
interface Row {
  login: LoginEvent;
  customer: Customer;
  flags: RiskFlag[];
}

/**
 * The log's columns on laptops (from xl): customer, result, when, address, place, device, notes, the
 * action. The header and every row share them (a subgrid), so each column is as wide as its widest
 * value: the result, the time, the address, the notes and the action take what they need and are
 * never cut; the customer, the place and the device share the rest, at least `spacing-16` each, and
 * end in an ellipsis (the whole text is their title) when they are longer. Below xl a sign-in is the
 * phone's two lines: eight columns do not fit a tablet or a small laptop.
 */
const COLUMNS = "xl:grid-cols-[minmax(var(--spacing-16),1fr)_auto_auto_auto_minmax(var(--spacing-16),1fr)_minmax(var(--spacing-16),1fr)_auto_auto]";

const IP = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$|^[0-9a-f:]{2,39}$/i;

/** "Leipzig" in German and English; in Arabic the Latin city name sits in its own isolate (A-23). */
export function Place({ code, city, unknown }: { code: string; city?: string | undefined; unknown: string }) {
  const locale = useLocale();
  return (
    <>
      {country(code, locale, unknown)}
      {city ? (
        <>
          {" · "}
          <bdi>{city}</bdi>
        </>
      ) : null}
    </>
  );
}

/**
 * The place on a sign-in row: the country, then the city in its own isolate that truncates by
 * itself, so a Latin city in an Arabic row keeps its start ("Abu Dh…", not "…bi"). The city takes
 * the room the country leaves (it is cut first) and stands right after the dot on the row's side,
 * also in an Arabic row; the whole place is the title of a cut one.
 */
function PlaceLine({ code, city, unknown }: { code: string; city?: string | undefined; unknown: string }) {
  const locale = useLocale();
  const name = country(code, locale, unknown);
  return (
    // On a phone's second line it starts at 64 px and takes the room left; the notes wrap below it.
    <span className="flex min-w-0 grow basis-16 items-center gap-1" title={city ? `${name} · ${city}` : name}>
      <span className="min-w-0 truncate">{name}</span>
      {city ? (
        <>
          <span className="shrink-0">·</span>
          <bdi data-city className="min-w-0 flex-1 truncate text-left [[dir=rtl]_&]:text-right">
            {city}
          </bdi>
        </>
      ) : null}
    </span>
  );
}

/**
 * One sign-in as a compact card on a phone (who and the result, then when, where, with what) and as
 * a row of aligned columns on laptops (A-11: nothing is cut off at the side). Blocking the address is
 * the row's one action, at its end.
 */
function LogRow({ row, now, canBlock, onBlock }: { row: Row; now: number; canBlock: boolean; onBlock: (ip: string) => void }) {
  const t = useTranslations("admin.security");
  const tc = useTranslations("admin.customers");
  const locale = useLocale();
  const { login, customer, flags } = row;
  // Phones: two lines (who, the result and when; then the address, the place, the device and any
  // warning, which takes a third line rather than running under the block button). The name's link
  // covers the row there, a target as tall as the row; the block button sits above it. From xl the
  // same elements become the cells of one row of the log's grid (`xl:contents` here, the row a
  // subgrid), and only the name is the link. The row's edges are its first and last cells' margins
  // (a subgrid's own padding would widen only its own first and last columns).
  return (
    <li data-login={login.id} className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-4 py-1 xl:col-span-full xl:grid-cols-subgrid xl:gap-x-3 xl:px-0 xl:py-3">
      <div className="grid min-w-0 gap-0.5 xl:contents">
        <p className="flex min-w-0 items-center gap-2 xl:contents">
          <Link
            href={`/admin/customers/${customer.id}`}
            className="block min-w-0 rounded-xs text-small font-semibold text-fg transition-colors duration-micro hover:text-link focus-visible:focus-ring max-xl:after:absolute max-xl:after:inset-0 xl:ms-4"
          >
            {/* Cut in its own direction (a Latin name in an Arabic row keeps its start), on the row's side. */}
            <bdi title={customer.name} className="block truncate text-left [[dir=rtl]_&]:text-right">
              {customer.name}
            </bdi>
          </Link>
          <span className="shrink-0">
            <Badge size="sm" tone={login.result === "success" ? "success" : "danger"}>
              {t(`result.${login.result}`)}
            </Badge>
          </span>
          <time dateTime={login.at} title={dateTime(login.at, locale)} className="ms-auto shrink-0 whitespace-nowrap text-caption text-fg-secondary xl:ms-0 xl:text-small xl:text-fg">
            {timeAgo(login.at, now, locale)}
          </time>
        </p>
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption text-fg-secondary xl:contents xl:text-small">
          <span dir="ltr" data-ip className="shrink-0 whitespace-nowrap text-start font-mono text-caption rtl:text-end">
            {login.ip || "–"}
          </span>
          <PlaceLine code={login.country ?? ""} city={login.city} unknown={tc("unknownCountry")} />
          <span className="min-w-0 max-xl:hidden">
            <DeviceLabel device={login.device} />
          </span>
          <span className="shrink-0 xl:hidden">
            <DeviceGlyph device={login.device} />
          </span>
          <span className="shrink-0">
            <RiskBadges flags={flags} />
          </span>
        </p>
      </div>
      {canBlock ? <BlockButton ip={login.ip} onBlock={onBlock} className="xl:me-4" /> : <span className="xl:me-4" />}
    </li>
  );
}

/** Every sign-in to every account: where, with what, and whether it looks wrong. Block an address in one tap. */
export function SecurityScreen() {
  const t = useTranslations("admin.security");
  const tc = useTranslations("admin.customers");
  const locale = useLocale();
  const params = useSearchParams();
  const { can } = useAdmin();
  const actions = useConsoleActions();
  const tCustomer = useTranslations("admin.customer");
  const { customers, now, ready, blockedIps } = useCustomers();
  const [pane, setPane] = useState<Pane>(PANES.find((value) => value === params.get("filter")) ?? "all");
  const [page, setPage] = useState(0);
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [ipError, setIpError] = useState<string | undefined>();
  const [pending, setPending] = useState<string | null>(null);
  const blocked = useMemo(() => new Set(blockedIps.map((entry) => entry.ip)), [blockedIps]);
  const log = useRef<HTMLElement>(null);
  /**
   * The blocked addresses from the KPI tile on the first screen: on a phone the pane's segment can sit
   * past the edge of the sideways strip. Opens the pane, brings it into view and puts focus on its
   * segment, so a keyboard continues there.
   */
  const showBlocked = () => {
    setPane("blocked");
    setPage(0);
    requestAnimationFrame(() => {
      const section = log.current;
      if (!section) return;
      section.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      section.querySelector<HTMLElement>("[role=radio][aria-checked=true]")?.focus({ preventScroll: true });
    });
  };

  const rows = useMemo<Row[]>(
    () =>
      customers
        .flatMap((customer) => customer.logins.map((login) => ({ login, customer, flags: riskFlags(login, customer.logins, blocked) })))
        .sort((a, b) => b.login.at.localeCompare(a.login.at)),
    [customers, blocked],
  );
  const day = rows.filter((row) => daysAgo(now, row.login.at) <= 1);
  const lists = {
    all: rows,
    failed: rows.filter((row) => row.login.result === "failed"),
    risky: rows.filter((row) => row.flags.length > 0),
  };
  const list = pane === "blocked" ? [] : lists[pane];
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = list.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const newDevices = rows.filter((row) => daysAgo(now, row.login.at) <= 7 && row.flags.includes("new-device")).length;
  const failedDay = day.filter((row) => row.login.result === "failed").length;
  const burst = day.some((row) => row.flags.includes("failed-burst"));

  const block = (address: string, why: string) => {
    void actions
      .blockIp(address, why)
      .then((done) => toast(done ? { title: t("blockedToast", { ip: address }), tone: "success" } : { title: tCustomer("toast.failed"), tone: "danger" }));
  };

  return (
    <Screen title={t("title")} lead={t("lead")} wide>
      {ready ? (
        <>
          <dl data-kpis className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label={t("kpi.signIns")} value={count(day.filter((row) => row.login.result === "success").length, locale)} footer={t("kpi.last24", { hours: 24 })} />
            <KpiTile
              label={t("kpi.failed")}
              value={count(failedDay, locale)}
              // A burst of failures is said in words, not only by the tile's colour.
              footer={burst ? <span className="font-semibold text-danger-strong">{t("kpi.burst")}</span> : t("kpi.last24", { hours: 24 })}
            />
            <KpiTile label={t("kpi.newDevices")} value={count(newDevices, locale)} footer={t("kpi.last7", { days: 7 })} />
            <KpiTile
              label={t("kpi.blocked")}
              value={count(blockedIps.length, locale)}
              // The way to the blocked addresses, in the footer's one line (the page stays within its height
              // budget); at least 24 px tall, the WCAG target size.
              footer={
                <button
                  type="button"
                  data-show-blocked
                  onClick={showBlocked}
                  className="-ms-1 inline-flex min-h-6 items-center gap-1 rounded-xs px-1 font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring"
                >
                  {t("kpi.manageBlocked")}
                  <Icon icon={icons.next} size="sm" />
                </button>
              }
            />
          </dl>

          <section ref={log} aria-labelledby="log-title" className="grid scroll-mt-16 grid-cols-1 gap-4">
            <h2 id="log-title" className="sr-only">
              {t.markup("logTitle", { bdi: isolate })}
            </h2>
            {/* Four panes, one line; the blocked addresses are a pane of their own (A-11). */}
            <Segmented
              label={t("filter")}
              value={pane}
              onValueChange={(next) => {
                setPane(next);
                setPage(0);
              }}
              className="justify-self-start"
              formatCount={(value) => count(value, locale)}
              options={PANES.map((value) => ({ value, label: t(`filters.${value}`), count: value === "blocked" ? blockedIps.length : lists[value].length }))}
            />

            {pane === "blocked" ? (
              <div className="grid grid-cols-1 gap-4">
                {can("security.manage") ? (
                  <form
                    aria-label={t("blockTitle")}
                    className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const address = ip.trim();
                      if (!IP.test(address)) {
                        setIpError(t.markup("ipInvalid", { bdi: isolate }));
                        return;
                      }
                      setIpError(undefined);
                      block(address, reason.trim() || t("manual"));
                      setIp("");
                      setReason("");
                    }}
                  >
                    <TextField label={t.markup("ipLabel", { bdi: isolate })} value={ip} onChange={(event) => setIp(event.target.value)} error={ipError} ltr placeholder="203.0.113.7" />
                    <TextField label={t("reasonLabel")} value={reason} onChange={(event) => setReason(event.target.value)} />
                    <Button type="submit" variant="primary" icon={icons.block}>
                      {t("block")}
                    </Button>
                  </form>
                ) : null}
                {blockedIps.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-small text-fg-secondary">{t("noBlocked")}</p>
                ) : (
                  <ul aria-label={t("blockedTitle")} className="grid divide-y divide-line rounded-lg border border-line bg-surface">
                    {blockedIps.map((entry) => (
                      <li key={entry.ip} className="flex items-center gap-3 px-4 py-3">
                        <Icon icon={ShieldAlert} size="sm" className="shrink-0 text-danger-strong" />
                        <span className="grid min-w-0 flex-1">
                          <span dir="ltr" className="truncate text-start font-mono text-small">
                            {entry.ip}
                          </span>
                          <span className="truncate text-caption text-fg-tertiary">
                            {entry.reason} · {timeAgo(entry.at, now, locale)}
                          </span>
                        </span>
                        {can("security.manage") ? (
                          <Button
                            size="sm"
                            icon={ShieldOff}
                            onClick={() => {
                              void actions
                                .unblockIp(entry.ip)
                                .then((done) => toast(done ? { title: t("unblockedToast", { ip: entry.ip }), tone: "success" } : { title: tCustomer("toast.failed"), tone: "danger" }));
                            }}
                          >
                            {t("unblock")}
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {/* From xl one grid: the header and every row are subgrids of it, so the columns fit the values of the page. */}
                <div className={cn("overflow-hidden rounded-lg border border-line bg-surface xl:grid xl:gap-x-3", COLUMNS)}>
                  {/* The column names on wide screens; on a phone every value says what it is by its place and glyph. */}
                  <div aria-hidden className="hidden border-b border-line bg-canvas-muted py-2 text-caption font-medium text-fg-secondary xl:col-span-full xl:grid xl:grid-cols-subgrid xl:gap-x-3">
                    <span className="ps-4">{t("columns.customer")}</span>
                    <span>{t("columns.result")}</span>
                    <span>{t("columns.when")}</span>
                    <span>{t.markup("columns.ip", { bdi: isolate })}</span>
                    <span>{t("columns.place")}</span>
                    <span>{t("columns.device")}</span>
                    <span>{t("columns.flags")}</span>
                    <span className="pe-4" />
                  </div>
                  {shown.length === 0 ? (
                    <p className="px-4 py-8 text-center text-small text-fg-secondary xl:col-span-full">{t("empty")}</p>
                  ) : (
                    <ul data-sign-ins aria-label={t.markup("logTitle", { bdi: isolate })} className="divide-y divide-line xl:col-span-full xl:grid xl:grid-cols-subgrid xl:gap-x-3">
                      {shown.map((row) => (
                        <LogRow key={row.login.id} row={row} now={now} canBlock={can("security.manage") && Boolean(row.login.ip) && !blocked.has(row.login.ip)} onBlock={setPending} />
                      ))}
                    </ul>
                  )}
                </div>
                <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3">
                  <Button icon={icons.previous} disabled={current === 0} onClick={() => setPage(current - 1)}>
                    {tc("previous")}
                  </Button>
                  <span className="text-small text-fg-secondary tabular-nums">{t.rich("pageRange", { from: list.length ? current * PAGE_SIZE + 1 : 0, to: current * PAGE_SIZE + shown.length, total: list.length, bdi: ltr })}</span>
                  <Button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} trailing={<Icon icon={icons.next} size="sm" />}>
                    {tc("next")}
                  </Button>
                </nav>
              </div>
            )}
          </section>

          <PrivacyNote />
          <DemoNote />
          {pending ? (
            <ConfirmDialog
              open
              onOpenChange={(open) => {
                if (!open) setPending(null);
              }}
              title={t("confirmTitle", { ip: pending })}
              description={t("confirmBody")}
              confirmLabel={t("block")}
              cancelLabel={t("keep")}
              onConfirm={() => {
                block(pending, t("fromLog"));
                setPending(null);
              }}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

/**
 * What the sign-in log keeps and why: open on laptops; on phones folded behind its heading, which is
 * the button that shows it, so the log stays near the top (Security fits in about three screens,
 * A-11). A real button with aria-expanded, not a native disclosure.
 */
function PrivacyNote() {
  const t = useTranslations("admin.security");
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="privacy-title" className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-line bg-surface px-4 py-2 lg:gap-4 lg:p-6">
      <h2 id="privacy-title" className="text-title rtl:tracking-normal">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="security-privacy"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-touch-target w-full items-center justify-between gap-3 rounded-sm text-start focus-visible:focus-ring lg:hidden"
        >
          {t("privacyTitle")}
          <Icon icon={icons.expand} size="md" className={cn("shrink-0 text-fg-tertiary transition-transform duration-standard ease-standard motion-reduce:transition-none", open && "rotate-180")} />
        </button>
        <span className="hidden lg:inline">{t("privacyTitle")}</span>
      </h2>
      <ul id="security-privacy" className={cn("gap-3 pb-2 text-small lg:grid lg:pb-0", open ? "grid" : "hidden")}>
        {(["what", "why", "how", "visitors", "rights"] as const).map((key) => (
          <li key={key} className="flex items-start gap-3">
            <Icon icon={key === "visitors" ? ShieldCheck : key === "rights" ? KeyRound : ShieldAlert} size="sm" className="mt-0.5 shrink-0 text-fg-tertiary" />
            <span>{t.rich(`privacy.${key}`, { bdi })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
