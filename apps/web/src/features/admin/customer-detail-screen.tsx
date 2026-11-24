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
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  BadgeCheck,
  CalendarPlus,
  CreditCard,
  ExternalLink,
  Gift,
  LogOut,
  MoreHorizontal,
  ReceiptText,
  RotateCcw,
  Trash2,
  UserCheck,
  UserMinus,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState, type ReactNode } from "react";

import { TextArea } from "@/features/app/form";
import { Panel, Screen } from "@/features/app/screen";
import { referralTeam, useCustomerReferrals } from "@/features/referrals/team";
import type { CustomerReferrals, ReferralState, RewardKind } from "@/features/referrals/types";
import { Link, useRouter } from "@/i18n/navigation";
import { paymentsEnabled } from "@/lib/flags";
import { pageAddress } from "@/lib/page-url";
import { supabaseEnabled } from "@/lib/supabase/config";

import { useConsoleActions } from "./actions";
import { bdi, isolate } from "./bidi";
import { billingActions, scheduledEnd, type BillingAnswer } from "./billing";
import { CustomersHidden } from "./customers-list-screen";
import { sessionsOf, useCustomers } from "./customers/data";
import { DAY, hasProForLife, isPaying, monthlyRevenue, riskFlags, subscriptionSource, viewsMeasured, type Customer } from "./customers/model";
import { DemoNote, DeviceLabel, PlanBadge, RiskBadges, StatusBadges } from "./customers/ui";
import { count, country, date, dateTime, money, timeAgo } from "./format";
import { bare, CustomerLink, ProfileLinks, SignalChips, useReasonLabel, WHY_MAX } from "./referrals-screen";
import { useAdmin } from "./session";

type Tab = "overview" | "billing" | "security" | "notes" | "invites";
type Pending =
  | { kind: "suspend" | "cancel" | "stripeCancel" | "stripeResume" | "signoutAll" | "delete" }
  | { kind: "refund"; invoice: string; amount: number }
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
  const { can, db } = useAdmin();
  const actions = useConsoleActions();
  const { customers, now, ready, blockedIps, signedOut } = useCustomers();
  const customer = customers.find((candidate) => candidate.id === id);
  const [tab, setTab] = useState<Tab>("overview");
  const [pending, setPending] = useState<Pending>(null);
  const [confirmText, setConfirmText] = useState("");
  const [note, setNote] = useState("");
  const noteId = useId();
  const blocked = useMemo(() => new Set(blockedIps.map((entry) => entry.ip)), [blockedIps]);

  // Editors see no customers (and no e-mail addresses), also when the address is typed in.
  if (!can("customers.view")) return <CustomersHidden />;
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
  // What may happen to this customer's money, and how: Stripe through our server, the team's own Pro
  // by hand, the demo in this browser.
  const money_ = billingActions(customer, { live: supabaseEnabled, payments: paymentsEnabled, manage: can("billing.manage") });
  const source = subscriptionSource(customer);
  const ends = scheduledEnd(customer);
  /** Runs a console action, then says how it went. */
  const run = async (work: Promise<boolean>, message: string) => {
    if (await work) toast({ title: message, tone: "success" });
    else toast({ title: t("toast.failed"), tone: "danger" });
  };
  /** A money action: "done" only once Stripe did it and it is on record; otherwise why not. */
  const runBilling = async (work: Promise<BillingAnswer>, message: (answer: BillingAnswer & { ok: true }) => string, mails: boolean) => {
    const answer = await work;
    if (!answer.ok) {
      toast({ title: t.markup(`billingErrors.${answer.error}`, { bdi: isolate }), tone: "danger" });
      return;
    }
    toast({ title: message(answer), tone: "success" });
    if (mails && !answer.mailed) toast({ title: t("toast.notMailed"), tone: "neutral" });
  };
  const kindLabel = (kind: string) => (tk.has(`${kind}.label`) ? tk(`${kind}.label`) : kind);

  const setPlan = (plan: "free" | "pro") =>
    void run(
      actions.subscription(
        customer,
        "plan",
        plan === "pro"
          ? { plan, subscriptionStatus: "active", startedAt: new Date(now).toISOString(), canceledAt: null }
          : { plan, subscriptionStatus: null, canceledAt: null },
      ),
      t("toast.plan", { plan: plan === "pro" ? "Pro" : tc("plans.free") }),
    );
  const extendTrial = () => {
    const base = Math.max(now, sub.trialEndsAt ? Date.parse(sub.trialEndsAt) : now);
    void run(
      actions.subscription(customer, "trial", {
        plan: "pro",
        subscriptionStatus: "trialing",
        trialEndsAt: new Date(base + 14 * DAY).toISOString(),
        ...(sub.startedAt ? {} : { startedAt: new Date(now).toISOString() }),
      }),
      t.markup("toast.trial", { bdi: isolate }),
    );
  };
  const resume = () => void run(actions.subscription(customer, "resume", { subscriptionStatus: "active", canceledAt: null }), t("toast.resumed"));
  const toggleVerified = () =>
    void run(actions.verified(customer, !customer.verified), customer.verified ? t("toast.unverified") : t("toast.verified"));
  const signOut = (deviceId: string) => void run(actions.signOut(customer, [deviceId], signedOut(customer.id)), t("toast.signedOut"));

  const confirm = () => {
    if (!pending) return;
    if (pending.kind === "suspend") {
      const next = customer.status === "suspended" ? "active" : "suspended";
      void run(actions.status(customer, next), next === "suspended" ? t("toast.suspended") : t("toast.unsuspended"));
    } else if (pending.kind === "cancel") {
      void run(
        actions.subscription(customer, "cancel", { subscriptionStatus: "canceled", canceledAt: new Date(now).toISOString() }),
        t("toast.canceled"),
      );
    } else if (pending.kind === "stripeCancel") {
      void runBilling(
        actions.stripeSubscription(customer, "cancel"),
        (answer) => (answer.endsAt ? t.markup("toast.cancelScheduled", { date: date(answer.endsAt, locale), bdi: isolate }) : t("toast.canceled")),
        true,
      );
    } else if (pending.kind === "stripeResume") {
      void runBilling(actions.stripeSubscription(customer, "resume"), () => t("toast.resumed"), false);
    } else if (pending.kind === "signoutAll") {
      void run(
        actions.signOut(customer, devices.map((device) => device.deviceId), signedOut(customer.id)),
        t("toast.signedOutAll"),
      );
    } else if (pending.kind === "refund") {
      void runBilling(actions.refund(customer, pending.invoice), () => t("toast.refunded"), money_.refund === "stripe");
    } else if (pending.kind === "block") {
      void run(actions.blockIp(pending.ip, customer.username), t("toast.blocked", { ip: pending.ip }));
    } else {
      void actions.remove(customer).then((removed) => {
        toast(removed ? { title: t("toast.deleted"), tone: "success" } : { title: t("toast.failed"), tone: "danger" });
        if (removed) router.push("/admin/customers");
      });
    }
    setPending(null);
    setConfirmText("");
  };

  const menu: MenuItem[] = [
    ...(money_.trial ? [{ label: t.markup("actions.trial", { bdi: isolate }), icon: CalendarPlus, onSelect: extendTrial }] : []),
    ...(money_.resume === "stripe"
      ? [{ label: t("actions.resumeStripe"), icon: CreditCard, onSelect: () => setPending({ kind: "stripeResume" }) }]
      : money_.resume
        ? [{ label: t("actions.resume"), icon: CreditCard, onSelect: resume }]
        : []),
    ...(money_.cancel === "stripe"
      ? [{ label: t("actions.cancelStripe"), icon: CreditCard, destructive: true, onSelect: () => setPending({ kind: "stripeCancel" }) }]
      : money_.cancel
        ? [{ label: t("actions.cancel"), icon: CreditCard, destructive: true, onSelect: () => setPending({ kind: "cancel" }) }]
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
      (/^(customer|referral|reward|verification)\./.test(event.action) || event.action === "ip.block"),
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
          body: t.rich("confirm.cancelBody", { bdi }),
          label: t("actions.cancel"),
          destructive: true,
        },
        stripeCancel: {
          title: t("confirm.cancelStripeTitle"),
          body: t.rich("confirm.cancelStripeBody", { bdi }),
          label: t("actions.cancelStripe"),
          destructive: true,
        },
        stripeResume: {
          title: t("confirm.resumeStripeTitle"),
          body: t.rich("confirm.resumeStripeBody", { bdi }),
          label: t("actions.resumeStripe"),
          destructive: false,
        },
        signoutAll: {
          title: t("confirm.signoutTitle"),
          body: t("confirm.signoutBody", { count: devices.length }),
          label: t("actions.signoutAll"),
          destructive: false,
        },
        refund:
          money_.refund === "stripe"
            ? {
                title: t.markup("confirm.refundStripeTitle", { bdi: isolate }),
                body: t.rich("confirm.refundStripeBody", { amount: money(pending.kind === "refund" ? pending.amount : 0, locale, true), bdi }),
                label: t("actions.refund"),
                destructive: true,
              }
            : {
                title: t("confirm.refundTitle"),
                body: t("confirm.refundBody", { amount: money(pending.kind === "refund" ? pending.amount : 0, locale, true) }),
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
          {customer.email ? <span dir="ltr">{customer.email}</span> : null}
          <span dir="ltr">{pageAddress(customer.username)}</span>
        </span>
      }
      wide
    >
      <Link
        href="/admin/customers"
        className="text-small text-link focus-visible:focus-ring inline-flex items-center gap-1 justify-self-start rounded-sm font-medium hover:text-fg transition-colors duration-micro"
      >
        <Icon icon={ArrowLeft} size="sm" className="rtl:-scale-x-100" />
        {t("back")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={customer.name} size="md" />
        <PlanBadge customer={customer} />
        {hasProForLife(customer) ? (
          <Badge size="sm" tone="outline">
            {tc("proForLife")}
          </Badge>
        ) : null}
        <StatusBadges customer={customer} />
        {customer.verified ? (
          <Badge size="sm" tone="primary">
            <Icon icon={BadgeCheck} size="sm" />
            {t("verified")}
          </Badge>
        ) : null}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {/* By hand only without a Stripe subscription: the team's Pro is free of charge. */}
          {money_.manualPlan ? (
            <Menu
              trigger={
                <Button variant="primary" icon={CreditCard}>
                  {t("actions.plan")}
                </Button>
              }
              items={[
                { label: tc("plans.free"), onSelect: () => setPlan("free") },
                { label: t.markup("actions.givePro", { bdi: isolate }), onSelect: () => setPlan("pro") },
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

      {/* Five tabs are wider than a phone: the strip scrolls sideways from edge to edge (the page never
          does), with room around it for the focus ring. */}
      <div className="-mx-4 -my-1 overflow-x-auto px-4 py-1 md:mx-0 md:px-0">
        <Segmented
          label={t("tabs.label")}
          value={tab}
          onValueChange={setTab}
          className="whitespace-nowrap"
          options={(["overview", "billing", "security", "notes", "invites"] as const)
            .filter((key) =>
              key === "billing"
                ? can("billing.view")
                : key === "security"
                  ? can("security.view")
                  : key === "invites"
                    ? can("customers.view")
                    : true,
            )
            .map((value) => ({ value, label: t(`tabs.${value}`) }))}
        />
      </div>

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
                [
                  t("facts.source"),
                  <span key="origin" data-customer-source={customer.source}>
                    {customer.source === "live" ? t("liveSource") : customer.source === "device" ? tc("thisDevice") : t("sample")}
                  </span>,
                ],
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
                className="text-small text-link focus-visible:focus-ring inline-flex items-center gap-1 rounded-sm font-medium hover:text-fg transition-colors duration-micro"
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
                [t.markup("facts.views", { bdi: isolate }), viewsMeasured ? count(customer.usage.views30, locale) : t("notMeasured")],
                [t.markup("facts.clicks", { bdi: isolate }), viewsMeasured ? count(customer.usage.clicks30, locale) : t("notMeasured")],
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
                [t("facts.plan"), sub.plan === "pro" ? "Pro" : tc("plans.free")],
                [
                  t.markup("facts.planSource", { bdi: isolate }),
                  <span key="source" data-plan-source={source ?? (hasProForLife(customer) ? "reward" : "none")}>
                    {source ? t.rich(`sources.${source}`, { bdi }) : hasProForLife(customer) ? t.rich("sources.reward", { bdi }) : "–"}
                  </span>,
                ],
                [t("facts.status"), sub.status ? tc(`subscription.${sub.status}`) : "–"],
                [t("facts.mrr"), money(monthlyRevenue(customer, now), locale, true)],
                [t("facts.started"), sub.startedAt ? date(sub.startedAt, locale) : "–"],
                ends
                  ? [t("facts.endsAt"), <span key="ends" data-ends-at>{date(ends, locale)}</span>]
                  : [
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
            {/* "Demo: no money moves" is true only in the demo. */}
            {supabaseEnabled ? null : <p className="text-caption text-fg-tertiary">{t.rich("billingNote", { bdi })}</p>}
            {money_.waitingForPayments ? (
              <p role="note" data-stripe-waiting className="text-small text-fg-secondary">
                {t.rich("stripeWaiting", { bdi })}
              </p>
            ) : supabaseEnabled && source === "stripe" ? (
              <p className="text-caption text-fg-tertiary">{t.rich("stripeNote", { bdi })}</p>
            ) : null}
          </Panel>
          <Panel title={t("invoices")} id="invoices-title">
            {sub.invoices.length === 0 ? (
              <p className="text-small text-fg-secondary">{t("noInvoices")}</p>
            ) : (
              <div className="relative overflow-x-auto" role="region" aria-labelledby="invoices-title" tabIndex={0}>
                <table className="text-small w-full">
                  <thead className="text-caption text-fg-secondary">
                    <tr>
                      <th scope="col" className="py-2 pe-4 text-start font-medium">
                        {t("invoice.date")}
                      </th>
                      <th scope="col" className="py-2 pe-4 text-start font-medium">
                        {t("invoice.number")}
                      </th>
                      <th scope="col" className="py-2 pe-4 text-start font-medium">
                        {t("invoice.status")}
                      </th>
                      <th scope="col" className="py-2 text-end font-medium">
                        {t("invoice.amount")}
                      </th>
                      {money_.refund ? (
                        <th scope="col" className="py-2">
                          <span className="sr-only">{t("invoice.actions")}</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {[...sub.invoices].reverse().map((invoice) => (
                      <tr key={invoice.id} className="border-line border-t">
                        <td className="py-2 pe-4 whitespace-nowrap">{date(invoice.at, locale)}</td>
                        {/* The id reads left to right; the cell keeps the page's side (start in Arabic too). */}
                        <td className="text-caption py-2 pe-4 text-start">
                          <span dir="ltr" className="font-mono">
                            {invoice.id}
                          </span>
                        </td>
                        <td className="py-2 pe-4">
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
                        {money_.refund ? (
                          <td className="py-2 text-end">
                            {invoice.status === "paid" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={ReceiptText}
                                onClick={() => setPending({ kind: "refund", invoice: invoice.id, amount: invoice.amount })}
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
          <Panel title={t.markup("signInLog", { bdi: isolate })} id="signins-title">
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
                  void actions.note(customer, note.trim()).then((saved) => {
                    if (saved) setNote("");
                    else toast({ title: t("toast.failed"), tone: "danger" });
                  });
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
                  className="border-line-input bg-surface-elevated text-body sm:text-small text-fg hover:border-fg-tertiary focus-visible:border-focus focus-visible:focus-field rounded-md border p-3 outline-none"
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
                    {t.rich(`historyLine.${event.action.replace(".", "_")}`, {
                      actor: db.members.find((member) => member.email === event.actor)?.name ?? event.actor,
                      bdi,
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

      {/* Mounted only while open: the invite program is loaded when someone looks at it. */}
      {tab === "invites" ? <InvitesTab customer={customer} now={now} /> : null}

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
                  className="h-control-md border-line-input bg-surface-elevated text-small text-fg focus-visible:border-focus focus-visible:focus-field rounded-md border px-3 outline-none"
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

const REWARD_KINDS: readonly RewardKind[] = ["verification_review", "pro_for_life"];
const STATE_TONE: Record<ReferralState, "success" | "warning" | "neutral" | "danger"> = {
  pending: "neutral",
  qualified: "success",
  held: "warning",
  rejected: "danger",
  revoked: "neutral",
};

type Rewards = CustomerReferrals["rewards"];
type Invited = CustomerReferrals["invited"][number];
interface InviteAction {
  next: "qualified" | "revoked";
  label: string;
  icon: LucideIcon;
  destructive: boolean;
}
type InvitePending = { kind: "reward"; reward: RewardKind; granted: boolean } | { kind: "invite"; invite: Invited; action: InviteAction } | null;

/** A sample customer has no program data in this browser: what the console knows is their rewards. */
function rewardsOf(customer: Customer): Rewards {
  const rewards: Rewards = {};
  const { verificationReview, proForLife } = customer.rewards ?? {};
  if (verificationReview)
    rewards.verification_review = { at: verificationReview.at, source: verificationReview.source, revokedAt: verificationReview.revokedAt ?? null, reason: null };
  if (proForLife) rewards.pro_for_life = { at: proForLife.at, source: proForLife.source, revokedAt: proForLife.revokedAt ?? null, reason: null };
  return rewards;
}

/**
 * The customer's invite program: their code and who invited them, their rewards (Pro for life needs
 * billing.manage, the verification review customers.manage) and the accounts they invited. Mounted
 * only while its tab is open, so the program is loaded only when someone looks at it.
 */
function InvitesTab({ customer, now }: { customer: Customer; now: number }) {
  const t = useTranslations("admin.customer");
  const tc = useTranslations("admin.customers");
  const tr = useTranslations("admin.referrals");
  const ts = useTranslations("admin.security.columns");
  const tNav = useTranslations("admin.nav");
  const tRetry = useTranslations("app.invite");
  const locale = useLocale();
  const { can, me } = useAdmin();
  const program = useCustomerReferrals(customer.id);
  const { status, data } = program;
  const reasonLabel = useReasonLabel();
  const [pending, setPending] = useState<InvitePending>(null);
  const [why, setWhy] = useState("");
  const rewardIds = useId();

  if (status === "loading") {
    return (
      <p role="status" className="text-small text-fg-secondary">
        {t("loading")}
      </p>
    );
  }
  if (status === "error") {
    return (
      <div role="alert" className="border-line bg-surface grid justify-items-start gap-3 rounded-xl border p-4">
        <p className="text-body text-fg-secondary">{t("toast.failed")}</p>
        <Button onClick={() => program.reload()}>{tRetry("retry")}</Button>
      </div>
    );
  }

  const rewards = data ? data.rewards : rewardsOf(customer);
  const proForLife = rewards.pro_for_life;
  const none = t("invites.none");
  // Actions need the program's own data (a sample customer has none) and the right permission.
  const mayReward = (kind: RewardKind) => data !== null && can(kind === "pro_for_life" ? "billing.manage" : "customers.manage");
  const mayInvite = data !== null && can("customers.manage");
  const invitedBy = data?.invitedBy ?? null;

  const close = () => {
    setPending(null);
    setWhy("");
  };
  const report = (worked: boolean, message: string) =>
    toast(worked ? { title: message, tone: "success" } : { title: t("toast.failed"), tone: "danger" });
  const confirm = () => {
    if (!pending) return;
    const reason = why.trim();
    const today = date(new Date().toISOString(), locale);
    if (pending.kind === "reward") {
      const { reward, granted } = pending;
      // A reward given back keeps where it came from; one given by hand comes from the team.
      const source = rewards[reward]?.source ?? "team";
      void referralTeam
        .setReward({ customerId: customer.id, kind: reward, granted, actor: me.email, target: customer.username, ...(reason ? { why: reason } : {}) })
        .then((worked) =>
          report(worked, granted ? t("invites.granted", { date: today, source: tr(`source.${source}`) }) : t("invites.removed", { date: today, reason })),
        );
    } else {
      const { invite, action } = pending;
      void referralTeam
        .setReferral({ id: invite.id, next: action.next, actor: me.email, target: customer.username, ...(reason ? { why: reason } : {}) })
        .then((worked) => report(worked, t(`invites.state.${action.next}`)));
    }
    close();
  };

  /** Held → count it or not; counted → remove; refused or removed → restore. Unconfirmed ones wait. */
  const actionsFor = (invite: Invited): InviteAction[] => {
    if (invite.state === "held")
      return [
        { next: "qualified", label: t("invites.release"), icon: UserCheck, destructive: false },
        { next: "revoked", label: tr("held.reject"), icon: UserX, destructive: true },
      ];
    if (invite.state === "qualified") return [{ next: "revoked", label: t("invites.revokeInvite"), icon: UserMinus, destructive: true }];
    if (invite.state === "rejected" || invite.state === "revoked") return [{ next: "qualified", label: t("invites.restore"), icon: RotateCcw, destructive: false }];
    return [];
  };

  const rewardLabel = pending?.kind === "reward" ? bare(pending.granted ? t("invites.grant") : t("invites.revoke")) : "";

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title={t("invites.title")} id="invites-title">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div className="grid min-w-0 gap-0.5">
              <dt className="text-caption text-fg-tertiary">{t("invites.code")}</dt>
              <dd className="text-small min-w-0">
                {data?.code ? (
                  <span dir="ltr" className="font-mono">
                    {data.code}
                  </span>
                ) : (
                  none
                )}
              </dd>
            </div>
            <div className="grid min-w-0 gap-0.5">
              <dt className="text-caption text-fg-tertiary">{t("invites.counted")}</dt>
              <dd className="text-small min-w-0 tabular-nums">{data ? count(data.counted, locale) : none}</dd>
            </div>
            <div className="grid min-w-0 gap-0.5 sm:col-span-2">
              <dt className="text-caption text-fg-tertiary">{t("invites.invitedBy")}</dt>
              <dd className="text-small flex min-w-0 flex-wrap items-center gap-2">
                {invitedBy ? (
                  <>
                    <CustomerLink id={invitedBy.id} username={invitedBy.username} />
                    <Badge size="sm" tone={STATE_TONE[invitedBy.state]}>
                      {t(`invites.state.${invitedBy.state}`)}
                    </Badge>
                    {invitedBy.reason ? <span className="text-caption text-fg-secondary">{reasonLabel(invitedBy.reason)}</span> : null}
                    <SignalChips signals={invitedBy.signals} />
                  </>
                ) : (
                  none
                )}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel title={t("invites.rewards")} id="rewards-title">
          {proForLife && !proForLife.revokedAt && isPaying(customer, now) ? (
            <p className="bg-warning-subtle text-small text-warning-strong flex items-start gap-2 rounded-md px-3 py-2">
              <Icon icon={AlertTriangle} size="sm" className="mt-0.5 shrink-0" />
              <span>{t.rich("invites.paysAndPro", { bdi })}</span>
            </p>
          ) : null}
          <ul className="grid grid-cols-1 gap-2">
            {REWARD_KINDS.map((kind) => {
              const reward = rewards[kind];
              const active = Boolean(reward && !reward.revokedAt);
              const labelId = `${rewardIds}-${kind}`;
              return (
                <li key={kind} className="border-line flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <span className="grid min-w-0 gap-0.5">
                    <span id={labelId} className="text-small font-semibold">
                      {tr(`kind.${kind}`)}
                    </span>
                    <span className="text-caption text-fg-secondary">
                      {!reward
                        ? none
                        : reward.revokedAt
                          ? t("invites.removed", { date: date(reward.revokedAt, locale), reason: reward.reason?.length ? reward.reason : none })
                          : t("invites.granted", { date: date(reward.at, locale), source: tr(`source.${reward.source}`) })}
                    </span>
                  </span>
                  {mayReward(kind) ? (
                    <Button
                      size="sm"
                      variant={active ? "destructive" : "secondary"}
                      icon={active ? Trash2 : Gift}
                      aria-describedby={labelId}
                      onClick={() => setPending({ kind: "reward", reward: kind, granted: !active })}
                    >
                      {active ? t("invites.revoke") : t("invites.grant")}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel title={t("invites.list")} id="invited-title">
        {!data || data.invited.length === 0 ? (
          <p className="text-small text-fg-secondary">{none}</p>
        ) : (
          // `relative`: the column's screen-reader-only heading is positioned; without it, it would sit
          // outside this scroller and widen the whole page on a phone.
          <div className="relative overflow-x-auto" role="region" aria-labelledby="invited-title" tabIndex={0}>
            <table className="min-w-prose text-small w-full">
              <thead className="text-caption text-fg-secondary">
                <tr>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {tc("columns.customer")}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {t("invoice.status")}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {tr("verifications.reason")}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {ts("flags")}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {ts("when")}
                  </th>
                  {mayInvite ? (
                    <th scope="col" className="py-2">
                      <span className="sr-only">{t("invoice.actions")}</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {data.invited.map((invite) => (
                  <tr key={invite.id} className="border-line border-t align-middle">
                    <td className="py-2 pe-3">
                      <span className="flex flex-wrap items-center gap-1">
                        <CustomerLink id={invite.inviteeId} username={invite.username} />
                        {invite.status === "suspended" ? (
                          <Badge size="sm" tone="danger">
                            {tc("suspended")}
                          </Badge>
                        ) : null}
                      </span>
                    </td>
                    <td className="py-2 pe-3">
                      <Badge size="sm" tone={STATE_TONE[invite.state]}>
                        {t(`invites.state.${invite.state}`)}
                      </Badge>
                    </td>
                    <td className="text-fg-secondary py-2 pe-3">{invite.reason ? reasonLabel(invite.reason) : none}</td>
                    <td className="py-2 pe-3">
                      <SignalChips signals={invite.signals} />
                    </td>
                    <td className="text-fg-secondary py-2 pe-3 whitespace-nowrap">{date(invite.at, locale)}</td>
                    {mayInvite ? (
                      <td className="py-2 text-end">
                        <span className="flex flex-wrap justify-end gap-1">
                          {actionsFor(invite).map((action) => (
                            <Button
                              key={action.next}
                              size="sm"
                              variant={action.destructive ? "destructive" : "ghost"}
                              icon={action.icon}
                              onClick={() => setPending({ kind: "invite", invite, action })}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {data?.verifications.length ? (
        <Panel
          title={t("invites.verifications")}
          id="verifications-title"
          action={
            <Link
              href="/admin/referrals"
              className="text-small text-link focus-visible:focus-ring inline-flex items-center gap-1 rounded-sm font-semibold transition-colors duration-micro hover:text-fg"
            >
              {tNav("referrals")}
              <Icon icon={ArrowRight} size="sm" className="rtl:-scale-x-100" />
            </Link>
          }
        >
          <ul className="grid grid-cols-1 gap-2">
            {data.verifications.map((request) => (
              <li key={request.id} className="border-line grid gap-2 rounded-md border p-3">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-small">{tr("verifications.requested", { date: date(request.at, locale) })}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    {request.state === "declined" && request.declineReason ? (
                      <span className="text-caption text-fg-secondary">{tr(`declineReasons.${request.declineReason}`)}</span>
                    ) : null}
                    <Badge size="sm" tone={request.state === "approved" ? "success" : request.state === "declined" ? "neutral" : "warning"}>
                      {request.state === "approved"
                        ? tr("verifications.approved")
                        : request.state === "declined"
                          ? tr("verifications.declined")
                          : t("invites.state.held")}
                    </Badge>
                  </span>
                </span>
                <ProfileLinks links={request.links} />
                {request.note ? (
                  <p dir="auto" className="text-small text-fg-secondary break-words whitespace-pre-line">
                    {request.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {pending ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          title={pending.kind === "reward" ? `${rewardLabel}: ${tr(`kind.${pending.reward}`)}` : pending.action.label}
          description={
            pending.kind === "reward" && !pending.granted ? (
              t("invites.revokeBody")
            ) : pending.kind === "reward" ? (
              <span>
                <bdi>{customer.name}</bdi> · <span dir="ltr">@{customer.username}</span>
              </span>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-1">
                <span dir="ltr">@{customer.username}</span>
                <Icon icon={ArrowRight} size="sm" className="rtl:-scale-x-100" />
                <span dir="ltr">{pending.invite.username ? `@${pending.invite.username}` : none}</span>
              </span>
            )
          }
          confirmLabel={pending.kind === "reward" ? rewardLabel : pending.action.label}
          cancelLabel={t("confirm.keep")}
          destructive={pending.kind === "reward" ? !pending.granted : pending.action.destructive}
          // A reward changes only with a reason for the log; for an invite the reason is optional.
          confirmDisabled={pending.kind === "reward" && !why.trim()}
          initialFocus="first-field"
          onConfirm={confirm}
        >
          <TextArea
            label={pending.kind === "reward" ? t("invites.why") : tr("held.why")}
            value={why}
            onValue={setWhy}
            max={WHY_MAX}
            rows={2}
            required={pending.kind === "reward"}
          />
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
