"use client";

import { Avatar, Badge, Button, ConfirmDialog, Icon, Segmented, TextField, toast } from "@linkyo/ui";
import {
  Ban,
  KeyRound,
  LogIn,
  MonitorSmartphone,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  ShieldX,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import type { LoginEvent } from "@/features/account/types";
import { Panel, Screen } from "@/features/app/screen";
import { Link } from "@/i18n/navigation";

import { useConsoleActions } from "./actions";
import { KpiTile } from "./charts";
import { useCustomers } from "./customers/data";
import { daysAgo, riskFlags, type Customer, type RiskFlag } from "./customers/model";
import { DemoNote, DeviceLabel, RiskBadges } from "./customers/ui";
import { count, country, dateTime, timeAgo } from "./format";
import { useAdmin } from "./session";

type Filter = "all" | "failed" | "risky";
interface Row {
  login: LoginEvent;
  customer: Customer;
  flags: RiskFlag[];
}

const IP = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$|^[0-9a-f:]{2,39}$/i;

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
  const [filter, setFilter] = useState<Filter>(
    params.get("filter") === "risky" ? "risky" : params.get("filter") === "failed" ? "failed" : "all",
  );
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [ipError, setIpError] = useState<string | undefined>();
  const [pending, setPending] = useState<string | null>(null);
  const blocked = useMemo(() => new Set(blockedIps.map((entry) => entry.ip)), [blockedIps]);

  const rows = useMemo<Row[]>(
    () =>
      customers
        .flatMap((customer) =>
          customer.logins.map((login) => ({
            login,
            customer,
            flags: riskFlags(login, customer.logins, blocked),
          })),
        )
        .sort((a, b) => b.login.at.localeCompare(a.login.at)),
    [customers, blocked],
  );
  const day = rows.filter((row) => daysAgo(now, row.login.at) <= 1);
  const shown = rows
    .filter((row) =>
      filter === "failed" ? row.login.result === "failed" : filter === "risky" ? row.flags.length > 0 : true,
    )
    .slice(0, 100);
  const newDevices = rows.filter(
    (row) => daysAgo(now, row.login.at) <= 7 && row.flags.includes("new-device"),
  ).length;
  const unknown = tc("unknownCountry");

  const block = (address: string, why: string) => {
    void actions.blockIp(address, why).then((blocked) =>
      toast(blocked ? { title: t("blockedToast", { ip: address }), tone: "success" } : { title: tCustomer("toast.failed"), tone: "danger" }),
    );
  };

  return (
    <Screen title={t("title")} lead={t("lead")} wide>
      {ready ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile
              icon={LogIn}
              label={t("kpi.signIns")}
              value={count(day.filter((row) => row.login.result === "success").length, locale)}
              hint={t("kpi.last24")}
            />
            <KpiTile
              icon={ShieldX}
              label={t("kpi.failed")}
              value={count(day.filter((row) => row.login.result === "failed").length, locale)}
              hint={t("kpi.last24")}
              tone={day.some((row) => row.flags.includes("failed-burst")) ? "danger" : "neutral"}
            />
            <KpiTile
              icon={MonitorSmartphone}
              label={t("kpi.newDevices")}
              value={count(newDevices, locale)}
              hint={t("kpi.last7")}
              tone={newDevices ? "warning" : "neutral"}
            />
            <KpiTile
              icon={Ban}
              label={t("kpi.blocked")}
              value={count(blockedIps.length, locale)}
              hint={t("kpi.blockedHint")}
            />
          </div>

          <Panel title={t("logTitle")} id="log-title">
            <Segmented
              label={t("filter")}
              value={filter}
              onValueChange={setFilter}
              className="justify-self-start"
              options={(["all", "failed", "risky"] as const).map((value) => ({
                value,
                label: t(`filters.${value}`),
              }))}
            />
            <div className="overflow-x-auto" role="region" aria-labelledby="log-title" tabIndex={0}>
              <table className="min-w-prose text-small w-full">
                <thead className="text-caption text-fg-secondary">
                  <tr>
                    <th scope="col" className="py-2 text-start font-medium">
                      {t("columns.when")}
                    </th>
                    <th scope="col" className="py-2 text-start font-medium">
                      {t("columns.customer")}
                    </th>
                    <th scope="col" className="py-2 text-start font-medium">
                      {t("columns.result")}
                    </th>
                    <th scope="col" className="py-2 text-start font-medium">
                      {t("columns.ip")}
                    </th>
                    <th scope="col" className="py-2 text-start font-medium">
                      {t("columns.place")}
                    </th>
                    <th scope="col" className="py-2 text-start font-medium">
                      {t("columns.device")}
                    </th>
                    <th scope="col" className="py-2 text-start font-medium">
                      {t("columns.flags")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(({ login, customer, flags }) => (
                    <tr key={login.id} className="border-line border-t align-top">
                      <td className="py-2 whitespace-nowrap" title={dateTime(login.at, locale)}>
                        {timeAgo(login.at, now, locale)}
                      </td>
                      <td className="py-2">
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="focus-visible:focus-ring flex min-w-0 items-center gap-2 rounded-sm hover:underline"
                        >
                          <Avatar name={customer.name} size="sm" />
                          <span className="truncate">{customer.name}</span>
                        </Link>
                      </td>
                      <td className="py-2">
                        <Badge size="sm" tone={login.result === "success" ? "success" : "danger"}>
                          {t(`result.${login.result}`)}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <span className="flex items-center gap-1">
                          <span dir="ltr" className="text-caption font-mono">
                            {login.ip || "–"}
                          </span>
                          {can("security.manage") && login.ip && !blocked.has(login.ip) ? (
                            <button
                              type="button"
                              onClick={() => setPending(login.ip)}
                              className="size-control-sm text-fg-tertiary hover:bg-hover hover:text-danger-strong focus-visible:focus-ring grid place-items-center rounded-sm"
                            >
                              <Icon icon={Ban} size="sm" label={t("blockIp", { ip: login.ip })} />
                            </button>
                          ) : null}
                        </span>
                      </td>
                      <td className="py-2">
                        {country(login.country ?? "", locale, unknown)}
                        {login.city ? ` · ${login.city}` : ""}
                      </td>
                      <td className="py-2">
                        <span className="grid gap-0.5">
                          <DeviceLabel device={login.device} />
                          <span dir="ltr" className="text-caption text-fg-tertiary text-start font-mono">
                            {login.deviceId}
                          </span>
                        </span>
                      </td>
                      <td className="py-2">
                        <RiskBadges flags={flags} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-caption text-fg-tertiary">
              {t("shown", { shown: shown.length, total: rows.length })}
            </p>
          </Panel>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title={t("blockedTitle")} id="blocked-title">
              {can("security.manage") ? (
                <form
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const address = ip.trim();
                    if (!IP.test(address)) {
                      setIpError(t("ipInvalid"));
                      return;
                    }
                    setIpError(undefined);
                    block(address, reason.trim() || t("manual"));
                    setIp("");
                    setReason("");
                  }}
                >
                  <TextField
                    label={t("ipLabel")}
                    value={ip}
                    onChange={(event) => setIp(event.target.value)}
                    error={ipError}
                    ltr
                    placeholder="203.0.113.7"
                  />
                  <TextField
                    label={t("reasonLabel")}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <Button type="submit" variant="primary" icon={Ban}>
                    {t("block")}
                  </Button>
                </form>
              ) : null}
              {blockedIps.length === 0 ? (
                <p className="text-small text-fg-secondary">{t("noBlocked")}</p>
              ) : (
                <ul className="grid gap-2">
                  {blockedIps.map((entry) => (
                    <li key={entry.ip} className="border-line flex items-center gap-3 rounded-md border p-3">
                      <Icon icon={ShieldAlert} size="sm" className="text-danger-strong shrink-0" />
                      <span className="grid min-w-0 flex-1">
                        <span dir="ltr" className="text-small truncate text-start font-mono">
                          {entry.ip}
                        </span>
                        <span className="text-caption text-fg-tertiary truncate">
                          {entry.reason} · {timeAgo(entry.at, now, locale)}
                        </span>
                      </span>
                      {can("security.manage") ? (
                        <Button
                          size="sm"
                          icon={ShieldOff}
                          onClick={() => {
                            void actions.unblockIp(entry.ip).then((unblocked) =>
                              toast(
                                unblocked
                                  ? { title: t("unblockedToast", { ip: entry.ip }), tone: "success" }
                                  : { title: tCustomer("toast.failed"), tone: "danger" },
                              ),
                            );
                          }}
                        >
                          {t("unblock")}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title={t("privacyTitle")} id="privacy-title">
              <ul className="text-small grid gap-3">
                {(["what", "why", "how", "visitors", "rights"] as const).map((key) => (
                  <li key={key} className="flex items-start gap-3">
                    <Icon
                      icon={key === "visitors" ? ShieldCheck : key === "rights" ? KeyRound : ShieldAlert}
                      size="sm"
                      className="text-fg-tertiary mt-0.5 shrink-0"
                    />
                    <span>{t(`privacy.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
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
