"use client";

import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Icon,
  Menu,
  Segmented,
  toast,
  type MenuItem,
} from "@linkyo/ui";
import {
  ArrowLeft,
  Ban,
  BadgeCheck,
  CalendarPlus,
  CreditCard,
  ExternalLink,
  LogOut,
  MoreHorizontal,
  ReceiptText,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState, type ReactNode } from "react";

import { Panel, Screen } from "@/features/app/screen";
import { Link, useRouter } from "@/i18n/navigation";

import { sessionsOf, useCustomers } from "./customers/data";
import { DAY, monthlyRevenue, PLAN_PRICE, riskFlags } from "./customers/model";
import { overrides } from "./customers/overrides";
import { DemoNote, DeviceLabel, PlanBadge, RiskBadges, StatusBadges } from "./customers/ui";
import { count, country, date, dateTime, money, timeAgo } from "./format";
import { useAdmin } from "./session";
import { adminStore } from "./store";
import type { ActivityEvent } from "./types";

type Tab = "overview" | "billing" | "security" | "notes";
type Pending =
  | { kind: "suspend" | "cancel" | "signoutAll" | "delete" }
  | { kind: "refund"; invoice: string }
  | { kind: "block"; ip: string }
  | null;

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([term, value]) => (
        <div key={term} className="grid min-w-0 gap-0.5">
          <dt className="text-caption text-fg-tertiary">{term}</dt>
          <dd className="text-small min-w-0 truncate">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One customer, everything the team may see and do: page, subscription, devices and sign-ins, notes. */
export function CustomerDetailScreen({ id }: { id: string }) {
  const t = useTranslations("admin.customer");
  const tc = useTranslations("admin.customers");
  const ts = useTranslations("admin.security");
  const tk = useTranslations("app.welcome.kinds");
  const locale = useLocale();
  const router = useRouter();
  const { me, can, db } = useAdmin();
  const { customers, now, ready, blockedIps, signedOut } = useCustomers();
  const customer = customers.find((candidate) => candidate.id === id);
  const [tab, setTab] = useState<Tab>("overview");
  const [pending, setPending] = useState<Pending>(null);
  const [confirmText, setConfirmText] = useState("");
  const [note, setNote] = useState("");
  const noteId = useId();
  const blocked = useMemo(() => new Set(blockedIps.map((entry) => entry.ip)), [blockedIps]);

  if (!ready) return <Screen title={t("loading")}>{null}</Screen>;
  if (!customer) {
    return (
      <Screen title={t("notFound")} lead={t("notFoundLead")}>
        <Button asChild icon={ArrowLeft} className="justify-self-start [&_svg]:rtl:-scale-x-100">
          <Link href="/admin/customers">{t("back")}</Link>
        </Button>
      </Screen>
    );
  }

  const unknown = tc("unknownCountry");
  const sub = customer.subscription;
  const devices = sessionsOf(customer, signedOut(customer.id));
  const record = (action: ActivityEvent["action"], target = customer.username) =>
    adminStore.record(me.email, action, target);
  const done = (message: string) => toast({ title: message, tone: "success" });
  const kindLabel = (kind: string) => (tk.has(`${kind}.label`) ? tk(`${kind}.label`) : kind);

  const setPlan = (plan: "free" | "pro") => {
    overrides.patch(
      customer.id,
      plan === "pro"
        ? { plan, subscriptionStatus: "active", startedAt: new Date(now).toISOString(), canceledAt: null }
        : { plan, subscriptionStatus: null, canceledAt: null },
    );
    record("customer.plan");
    done(t("toast.plan", { plan: plan === "pro" ? "Pro" : tc("plans.free") }));
  };
  const extendTrial = () => {
    const base = Math.max(now, sub.trialEndsAt ? Date.parse(sub.trialEndsAt) : now);
    overrides.patch(customer.id, {
      plan: "pro",
      subscriptionStatus: "trialing",
      trialEndsAt: new Date(base + 14 * DAY).toISOString(),
      ...(sub.startedAt ? {} : { startedAt: new Date(now).toISOString() }),
    });
    record("customer.trial");
    done(t("toast.trial"));
  };
  const resume = () => {
    overrides.patch(customer.id, { subscriptionStatus: "active", canceledAt: null });
    record("customer.resume");
    done(t("toast.resumed"));
  };
  const toggleVerified = () => {
    overrides.patch(customer.id, { verified: !customer.verified });
    record(customer.verified ? "customer.unverify" : "customer.verify");
    done(customer.verified ? t("toast.unverified") : t("toast.verified"));
  };
  const signOut = (deviceId: string) => {
    overrides.patch(customer.id, { signedOut: [...signedOut(customer.id), deviceId] });
    record("customer.signout");
    done(t("toast.signedOut"));
  };

  const confirm = () => {
    if (!pending) return;
    if (pending.kind === "suspend") {
      const next = customer.status === "suspended" ? "active" : "suspended";
      overrides.patch(customer.id, { status: next });
      record(next === "suspended" ? "customer.suspend" : "customer.unsuspend");
      done(next === "suspended" ? t("toast.suspended") : t("toast.unsuspended"));
    } else if (pending.kind === "cancel") {
      overrides.patch(customer.id, {
        subscriptionStatus: "canceled",
        canceledAt: new Date(now).toISOString(),
      });
      record("customer.cancel");
      done(t("toast.canceled"));
    } else if (pending.kind === "signoutAll") {
      overrides.patch(customer.id, { signedOut: devices.map((device) => device.deviceId) });
      record("customer.signout");
      done(t("toast.signedOutAll"));
    } else if (pending.kind === "refund") {
      overrides.patch(customer.id, {
        refunded: [
          ...sub.invoices.filter((invoice) => invoice.status === "refunded").map((invoice) => invoice.id),
          pending.invoice,
        ],
      });
      record("customer.refund");
      done(t("toast.refunded"));
    } else if (pending.kind === "block") {
      overrides.blockIp({
        ip: pending.ip,
        at: new Date(now).toISOString(),
        by: me.email,
        reason: customer.username,
      });
      record("ip.block", pending.ip);
      done(t("toast.blocked", { ip: pending.ip }));
    } else {
      overrides.patch(customer.id, { deleted: true });
      record("customer.delete");
      done(t("toast.deleted"));
      router.push("/admin/customers");
    }
    setPending(null);
    setConfirmText("");
  };

  const menu: MenuItem[] = [
    ...(can("billing.manage")
      ? [
          { label: t("actions.trial"), icon: CalendarPlus, onSelect: extendTrial },
          ...(sub.status === "canceled"
            ? [{ label: t("actions.resume"), icon: CreditCard, onSelect: resume }]
            : sub.plan === "pro"
              ? [
                  {
                    label: t("actions.cancel"),
                    icon: CreditCard,
                    destructive: true,
                    onSelect: () => setPending({ kind: "cancel" }),
                  },
                ]
              : []),
        ]
      : []),
    ...(can("customers.manage")
      ? [
          {
            label: customer.verified ? t("actions.unverify") : t("actions.verify"),
            icon: BadgeCheck,
            onSelect: toggleVerified,
          },
          {
            label: t("actions.signoutAll"),
            icon: LogOut,
            onSelect: () => setPending({ kind: "signoutAll" }),
          },
          customer.status === "suspended"
            ? {
                label: t("actions.unsuspend"),
                icon: UserCheck,
                onSelect: () => setPending({ kind: "suspend" }),
              }
            : {
                label: t("actions.suspend"),
                icon: UserX,
                destructive: true,
                onSelect: () => setPending({ kind: "suspend" }),
              },
        ]
      : []),
    ...(can("customers.delete")
      ? [
          {
            label: t("actions.delete"),
            icon: Trash2,
            destructive: true,
            onSelect: () => setPending({ kind: "delete" }),
          },
        ]
      : []),
  ];

  const history = db.activity.filter(
    (event) =>
      event.target === customer.username &&
      (event.action.startsWith("customer.") || event.action === "ip.block"),
  );
  const dialog = pending
    ? {
        suspend: {
          title:
            customer.status === "suspended"
              ? t("confirm.unsuspendTitle")
              : t("confirm.suspendTitle", { name: customer.name }),
          body: customer.status === "suspended" ? t("confirm.unsuspendBody") : t("confirm.suspendBody"),
          label: customer.status === "suspended" ? t("actions.unsuspend") : t("actions.suspend"),
          destructive: customer.status !== "suspended",
        },
        cancel: {
          title: t("confirm.cancelTitle"),
          body: t("confirm.cancelBody"),
          label: t("actions.cancel"),
          destructive: true,
        },
        signoutAll: {
          title: t("confirm.signoutTitle"),
          body: t("confirm.signoutBody", { count: devices.length }),
          label: t("actions.signoutAll"),
          destructive: false,
        },
        refund: {
          title: t("confirm.refundTitle"),
          body: t("confirm.refundBody", { amount: money(PLAN_PRICE.pro, locale, true) }),
          label: t("actions.refund"),
          destructive: true,
        },
        block: {
          title: t("confirm.blockTitle", { ip: pending.kind === "block" ? pending.ip : "" }),
          body: t("confirm.blockBody"),
          label: t("actions.block"),
          destructive: true,
        },
        delete: {
          title: t("confirm.deleteTitle", { name: customer.name }),
          body: t("confirm.deleteBody", { username: customer.username }),
          label: t("actions.delete"),
          destructive: true,
        },
      }[pending.kind]
    : null;

  return (
    <Screen
      title={customer.name}
      lead={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span dir="ltr">{customer.email}</span>
          <span dir="ltr">linkyo.app/{customer.username}</span>
        </span>
      }
      wide
    >
      <Link
        href="/admin/customers"
        className="text-small text-link focus-visible:focus-ring inline-flex items-center gap-1 justify-self-start rounded-sm font-medium hover:underline"
      >
        <Icon icon={ArrowLeft} size="sm" className="rtl:-scale-x-100" />
        {t("back")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={customer.name} size="md" />
        <PlanBadge customer={customer} />
        <StatusBadges customer={customer} />
        {customer.verified ? (
          <Badge size="sm" tone="primary">
            <Icon icon={BadgeCheck} size="sm" />
            {t("verified")}
          </Badge>
        ) : null}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {can("billing.manage") ? (
            <Menu
              trigger={
                <Button variant="primary" icon={CreditCard}>
                  {t("actions.plan")}
                </Button>
              }
              items={[
                { label: `${tc("plans.free")} · ${money(0, locale)}`, onSelect: () => setPlan("free") },
                { label: `Pro · ${money(PLAN_PRICE.pro, locale, true)}`, onSelect: () => setPlan("pro") },
              ]}
            />
          ) : null}
          {menu.length ? (
            <Menu
              trigger={
                <Button icon={MoreHorizontal} aria-label={t("actions.more")}>
                  {t("actions.more")}
                </Button>
              }
              items={menu}
            />
          ) : null}
        </div>
      </div>

      <Segmented
        label={t("tabs.label")}
        value={tab}
        onValueChange={setTab}
        className="justify-self-start"
        options={(["overview", "billing", "security", "notes"] as const)
          .filter((key) =>
            key === "billing" ? can("billing.view") : key === "security" ? can("security.view") : true,
          )
          .map((value) => ({ value, label: t(`tabs.${value}`) }))}
      />

      {tab === "overview" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title={t("account")} id="account-title">
            <Facts
              items={[
                [
                  t("facts.country"),
                  `${country(customer.country, locale, unknown)}${customer.city ? ` · ${customer.city}` : ""}`,
                ],
                [
                  t("facts.language"),
                  new Intl.DisplayNames([locale], { type: "language" }).of(customer.locale) ??
                    customer.locale,
                ],
                [t("facts.since"), date(customer.createdAt, locale)],
                [t("facts.lastSeen"), timeAgo(customer.lastSeenAt, now, locale)],
                [t("facts.source"), customer.source === "device" ? tc("thisDevice") : t("sample")],
                [
                  t("facts.id"),
                  <span key="id" dir="ltr" className="text-caption font-mono">
                    {customer.id}
                  </span>,
                ],
              ]}
            />
          </Panel>
          <Panel
            title={t("page")}
            id="page-title"
            action={
              <Link
                href={`/p/${customer.username}`}
                className="text-small text-link focus-visible:focus-ring inline-flex items-center gap-1 rounded-sm font-medium hover:underline"
              >
                {t("openPage")}
                <Icon icon={ExternalLink} size="sm" />
              </Link>
            }
          >
            <Facts
              items={[
                [t("facts.kind"), kindLabel(customer.usage.kind)],
                [
                  t("facts.template"),
                  customer.usage.template
                    ? customer.usage.template.charAt(0).toUpperCase() + customer.usage.template.slice(1)
                    : "–",
                ],
                [t("facts.blocks"), count(customer.usage.blocks, locale)],
                [t("facts.onboarded"), customer.usage.onboarded ? t("yes") : t("no")],
                [t("facts.views"), count(customer.usage.views30, locale)],
                [t("facts.clicks"), count(customer.usage.clicks30, locale)],
              ]}
            />
          </Panel>
        </div>
      ) : null}

      {tab === "billing" ? (
        <div className="grid grid-cols-1 gap-6">
          <Panel title={t("subscription")} id="subscription-title">
            <Facts
              items={[
                [
                  t("facts.plan"),
                  sub.plan === "pro"
                    ? `Pro · ${money(PLAN_PRICE.pro, locale, true)} / ${t("month")}`
                    : `${tc("plans.free")} · ${money(0, locale)}`,
                ],
                [t("facts.status"), sub.status ? tc(`subscription.${sub.status}`) : "–"],
                [t("facts.mrr"), money(monthlyRevenue(customer), locale, true)],
                [t("facts.started"), sub.startedAt ? date(sub.startedAt, locale) : "–"],
                [
                  t("facts.renews"),
                  sub.renewsAt && sub.status !== "canceled" ? date(sub.renewsAt, locale) : "–",
                ],
                [
                  t("facts.trialEnds"),
                  sub.trialEndsAt && sub.status === "trialing" ? date(sub.trialEndsAt, locale) : "–",
                ],
                [t("facts.canceled"), sub.canceledAt ? date(sub.canceledAt, locale) : "–"],
              ]}
            />
            <p className="text-caption text-fg-tertiary">{t("billingNote")}</p>
          </Panel>
          <Panel title={t("invoices")} id="invoices-title">
            {sub.invoices.length === 0 ? (
              <p className="text-small text-fg-secondary">{t("noInvoices")}</p>
            ) : (
              <div className="overflow-x-auto" role="region" aria-labelledby="invoices-title" tabIndex={0}>
                <table className="text-small w-full">
                  <thead className="text-caption text-fg-secondary">
                    <tr>
                      <th scope="col" className="py-2 text-start font-medium">
                        {t("invoice.date")}
                      </th>
                      <th scope="col" className="py-2 text-start font-medium">
                        {t("invoice.number")}
                      </th>
                      <th scope="col" className="py-2 text-start font-medium">
                        {t("invoice.status")}
                      </th>
                      <th scope="col" className="py-2 text-end font-medium">
                        {t("invoice.amount")}
                      </th>
                      {can("billing.manage") ? (
                        <th scope="col" className="py-2">
                          <span className="sr-only">{t("invoice.actions")}</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {[...sub.invoices].reverse().map((invoice) => (
                      <tr key={invoice.id} className="border-line border-t">
                        <td className="py-2 whitespace-nowrap">{date(invoice.at, locale)}</td>
                        <td className="text-caption py-2 font-mono" dir="ltr">
                          {invoice.id}
                        </td>
                        <td className="py-2">
                          <Badge
                            size="sm"
                            tone={
                              invoice.status === "paid"
                                ? "success"
                                : invoice.status === "failed"
                                  ? "danger"
                                  : "neutral"
                            }
                          >
                            {t(`invoice.${invoice.status}`)}
                          </Badge>
                        </td>
                        <td className="py-2 text-end tabular-nums">{money(invoice.amount, locale, true)}</td>
                        {can("billing.manage") ? (
                          <td className="py-2 text-end">
                            {invoice.status === "paid" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={ReceiptText}
                                onClick={() => setPending({ kind: "refund", invoice: invoice.id })}
                              >
                                {t("actions.refund")}
                              </Button>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === "security" ? (
        <div className="grid grid-cols-1 gap-6">
          <Panel title={t("devices")} id="devices-title">
            {devices.length === 0 ? (
              <p className="text-small text-fg-secondary">{t("noDevices")}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2">
                {devices.map((device) => (
                  <li
                    key={device.deviceId}
                    className="border-line grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="text-small grid min-w-0 gap-1">
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        <DeviceLabel device={device.device} />
                        {device.signedOut ? (
                          <Badge size="sm" tone="neutral">
                            {t("signedOut")}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="text-caption text-fg-secondary">
                        <span dir="ltr" className="font-mono">
                          {device.ip}
                        </span>{" "}
                        · {country(device.country ?? "", locale, unknown)}
                        {device.city ? ` · ${device.city}` : ""} ·{" "}
                        {t("lastUsed", { when: timeAgo(device.lastAt, now, locale) })} ·{" "}
                        {t("signIns", { count: device.signIns })}
                      </span>
                      <span className="text-caption text-fg-tertiary">
                        {t("deviceId")}:{" "}
                        <span dir="ltr" className="font-mono">
                          {device.deviceId}
                        </span>
                      </span>
                    </div>
                    {can("customers.manage") && !device.signedOut ? (
                      <Button
                        size="sm"
                        icon={LogOut}
                        onClick={() => signOut(device.deviceId)}
                        className="justify-self-start"
                      >
                        {t("actions.signout")}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={t("signInLog")} id="signins-title">
            <div className="overflow-x-auto" role="region" aria-labelledby="signins-title" tabIndex={0}>
              <table className="min-w-prose text-small w-full">
                <thead className="text-caption text-fg-secondary">
                  <tr>
                    <th scope="col" className="py-2 text-start font-medium">
                      {ts("columns.when")}
                    </th>
                    <th scope="col" className="py-2 text-start font-medium">
                      {ts("columns.result")}
                    </th>
                    <th scope="col" className="py-2 text-start font-medium">
                      {ts("columns.ip")}
                    </th>
                    <th scope="col" className="py-2 text-start font-medium">
                      {ts("columns.place")}
                    </th>
                    <th scope="col" className="py-2 text-start font-medium">
                      {ts("columns.device")}
                    </th>
                    <th scope="col" className="py-2 text-start font-medium">
                      {ts("columns.signature")}
                    </th>
                    <th scope="col" className="py-2 text-start font-medium">
                      {ts("columns.flags")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customer.logins.map((login) => (
                    <tr key={login.id} className="border-line border-t align-top">
                      <td className="py-2 whitespace-nowrap">{dateTime(login.at, locale)}</td>
                      <td className="py-2">
                        <Badge size="sm" tone={login.result === "success" ? "success" : "danger"}>
                          {ts(`result.${login.result}`)}
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
                              onClick={() => setPending({ kind: "block", ip: login.ip })}
                              className="size-control-sm text-fg-tertiary hover:bg-hover hover:text-danger-strong focus-visible:focus-ring grid place-items-center rounded-sm"
                            >
                              <Icon icon={Ban} size="sm" label={t("actions.blockIp", { ip: login.ip })} />
                            </button>
                          ) : null}
                        </span>
                      </td>
                      <td className="py-2">
                        {country(login.country ?? "", locale, unknown)}
                        {login.city ? ` · ${login.city}` : ""}
                      </td>
                      <td className="py-2">
                        <DeviceLabel device={login.device} />
                      </td>
                      <td className="py-2">
                        <span dir="ltr" className="text-caption text-fg-secondary font-mono">
                          {login.signature ?? "–"}
                        </span>
                      </td>
                      <td className="py-2">
                        <RiskBadges flags={riskFlags(login, customer.logins, blocked)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-caption text-fg-tertiary">{ts("retention")}</p>
          </Panel>
        </div>
      ) : null}

      {tab === "notes" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title={t("notes")} id="notes-title">
            {can("customers.manage") ? (
              <form
                className="grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!note.trim()) return;
                  overrides.addNote(customer.id, {
                    id: crypto.randomUUID(),
                    at: new Date().toISOString(),
                    author: me.name,
                    text: note.trim(),
                  });
                  record("customer.note");
                  setNote("");
                }}
              >
                <label htmlFor={noteId} className="text-small font-medium">
                  {t("addNote")}
                </label>
                <textarea
                  id={noteId}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  dir="auto"
                  placeholder={t("notePlaceholder")}
                  className="border-line-input bg-surface-elevated text-small text-fg hover:border-fg-tertiary focus-visible:border-focus focus-visible:focus-ring rounded-md border p-3 outline-none"
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!note.trim()}
                  className="justify-self-start"
                >
                  {t("saveNote")}
                </Button>
              </form>
            ) : null}
            {customer.notes.length === 0 ? (
              <p className="text-small text-fg-secondary">{t("noNotes")}</p>
            ) : (
              <ul className="grid gap-2">
                {customer.notes.map((entry) => (
                  <li key={entry.id} className="bg-canvas-muted grid gap-1 rounded-md p-3">
                    <p dir="auto" className="text-small whitespace-pre-line">
                      {entry.text}
                    </p>
                    <p className="text-caption text-fg-tertiary">
                      {entry.author} · {timeAgo(entry.at, now, locale)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={t("history")} id="history-title">
            {history.length === 0 ? (
              <p className="text-small text-fg-secondary">{t("noHistory")}</p>
            ) : (
              <ul className="grid gap-2">
                {history.map((event) => (
                  <li key={event.id} className="text-small">
                    {t(`historyLine.${event.action.replace(".", "_")}`, {
                      actor: db.members.find((member) => member.email === event.actor)?.name ?? event.actor,
                    })}
                    <span className="text-caption text-fg-tertiary block">
                      {timeAgo(event.at, now, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}

      <DemoNote />

      {dialog ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setPending(null);
              setConfirmText("");
            }
          }}
          title={dialog.title}
          description={
            pending?.kind === "delete" ? (
              <span className="grid gap-3">
                <span>{dialog.body}</span>
                <input
                  aria-label={t("confirm.typeUsername", { username: customer.username })}
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  dir="ltr"
                  className="h-control-md border-line-input bg-surface-elevated text-small text-fg focus-visible:border-focus focus-visible:focus-ring rounded-md border px-3 outline-none"
                />
              </span>
            ) : (
              dialog.body
            )
          }
          confirmLabel={dialog.label}
          cancelLabel={t("confirm.keep")}
          destructive={dialog.destructive}
          confirmDisabled={pending?.kind === "delete" && confirmText.trim() !== customer.username}
          onConfirm={confirm}
        />
      ) : null}
    </Screen>
  );
}
