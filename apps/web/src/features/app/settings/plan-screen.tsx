"use client";

import { Badge, Icon, icons, Skeleton, Spinner, toast } from "@linkyo/ui";
import { CalendarClock, Check, FileX, type LucideIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { useAiQuota, type AiQuotaView } from "@/features/ai/quota";
import { useAppMode } from "@/features/app-mode/use-app-mode";
import { formatEuro, PRICES, PRO_DRAFTS } from "@/features/payments/prices";
import { PRO_AVAILABLE } from "@/features/referrals/rules";
import type { Locale } from "@/i18n/routing";
import { paymentsEnabled, paymentsMode } from "@/lib/flags";
import { accessToken } from "@/lib/supabase/access-token";
import { browserSupabase } from "@/lib/supabase/browser";
import { supabaseEnabled } from "@/lib/supabase/config";

import { ListGroup, ListRow } from "../list";
import { ProgressBar } from "../progress-bar";
import { SETTINGS_HREF } from "../routes";
import { ColumnGroups, Screen } from "../screen";
import { useSite } from "../site-context";

// ─── What the account's plan is ──────────────────────────────────────────────────────────────

/** The owner's rows, as row-level security lets them read them (only the columns used here). */
export interface EntitlementRow {
  source: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  stripe_customer_id: string | null;
  created_at: string;
}
export interface RewardRow {
  kind: string;
  revoked_at: string | null;
}
export interface SubscriptionRow {
  plan: string;
  status: string | null;
  trial_ends_at: string | null;
}
export interface InvoiceRow {
  id: string;
  at: string;
  amount_cents: number;
  status: string;
}

/** Where Pro comes from: bought through Stripe, given by the team, or the invite program's reward. */
export type PlanSource = "free" | "stripe" | "team" | "reward";

export interface PlanView {
  plan: "free" | "pro";
  source: PlanSource;
  /** Stripe could not take the last payment and tries again; the plan still runs meanwhile. */
  pastDue: boolean;
  /** The day a running subscription renews (null when it ends, or does not renew). */
  renewsAt: string | null;
  /** The day the plan ends: a cancellation, or the end of a trial the team gave. */
  endsAt: string | null;
  /** The team's Pro is a trial (`endsAt` is then the trial's end). */
  trial: boolean;
  /** Stripe knows this account, so its customer portal can open (also after a subscription ended). */
  customer: boolean;
  /** The newest invoices, newest first. */
  invoices: InvoiceRow[];
}

/** How many invoices the pane lists; the portal has all of them. */
export const INVOICES_SHOWN = 3;

export const FREE_PLAN: PlanView = { plan: "free", source: "free", pastDue: false, renewsAt: null, endsAt: null, trial: false, customer: false, invoices: [] };

const running = (status: string) => status === "active" || status === "past_due";

/**
 * The plan as the database decides it, from the owner's own rows. The same order of checks as
 * `public.has_pro()` (20261123100400_review_fixes.sql): a running entitlement inside its period
 * (a Stripe subscription wins, it is the one with billing), the invite program's Pro for life, and
 * Pro the team set in `subscriptions`, which counts only while no Stripe subscription is running.
 */
export function planFrom(
  rows: { entitlements: readonly EntitlementRow[]; rewards: readonly RewardRow[]; subscription: SubscriptionRow | null; invoices: readonly InvoiceRow[] },
  now: Date = new Date(),
): PlanView {
  const inPeriod = (row: EntitlementRow) => running(row.status) && (row.current_period_end === null || Date.parse(row.current_period_end) > now.getTime());
  const future = (at: string | null) => (at !== null && Date.parse(at) > now.getTime() ? at : null);
  const stripe = rows.entitlements.filter((row) => row.source === "stripe");
  const base = { ...FREE_PLAN, customer: stripe.some((row) => Boolean(row.stripe_customer_id)), invoices: rows.invoices.slice(0, INVOICES_SHOWN) };

  const bought = stripe.find(inPeriod);
  if (bought) {
    // Stripe ends it at the period end (cancel_at_period_end) or on a later day the owner chose (cancel_at).
    const ending = bought.cancel_at ?? (bought.cancel_at_period_end ? bought.current_period_end : null);
    return { ...base, plan: "pro", source: "stripe", pastDue: bought.status === "past_due", renewsAt: ending ? null : bought.current_period_end, endsAt: ending };
  }
  const given = rows.entitlements.find((row) => row.source !== "stripe" && inPeriod(row));
  if (given) return { ...base, plan: "pro", source: "team", endsAt: future(given.current_period_end) };
  if (rows.rewards.some((reward) => reward.kind === "pro_for_life" && reward.revoked_at === null)) return { ...base, plan: "pro", source: "reward" };
  const subscription = rows.subscription;
  const stripeRunning = stripe.some((row) => running(row.status));
  if (subscription?.plan === "pro" && (subscription.status === "active" || subscription.status === "trialing") && !stripeRunning) {
    const trial = subscription.status === "trialing";
    return { ...base, plan: "pro", source: "team", trial, endsAt: trial ? future(subscription.trial_ends_at) : null };
  }
  return base;
}

/** The owner's plan rows, read in the browser as the owner (row-level security). Null when any read fails. */
async function loadPlan(account: string): Promise<PlanView | null> {
  const db = browserSupabase();
  try {
    const [entitlements, rewards, subscription, invoices] = await Promise.all([
      db
        .from("entitlements")
        .select("source, status, current_period_end, cancel_at_period_end, cancel_at, stripe_customer_id, created_at")
        .eq("profile_id", account)
        .order("created_at", { ascending: false }),
      db.from("rewards").select("kind, revoked_at").eq("profile_id", account),
      db.from("subscriptions").select("plan, status, trial_ends_at").eq("profile_id", account).maybeSingle(),
      db.from("invoices").select("id, at, amount_cents, status").eq("profile_id", account).order("at", { ascending: false }).limit(INVOICES_SHOWN),
    ]);
    if (entitlements.error || rewards.error || subscription.error || invoices.error) return null;
    return planFrom({ entitlements: entitlements.data, rewards: rewards.data, subscription: subscription.data, invoices: invoices.data });
  } catch {
    return null;
  }
}

export type PlanState = { status: "loading" } | { status: "failed" } | { status: "ready"; view: PlanView };

/**
 * The signed-in owner's plan. The demo has no plans and no payments: every demo account is Free,
 * said as it is, without asking anyone.
 */
export function usePlan(account: string): { state: PlanState; retry: () => void } {
  const [state, setState] = useState<PlanState>(supabaseEnabled ? { status: "loading" } : { status: "ready", view: FREE_PLAN });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!supabaseEnabled) return;
    let live = true;
    void loadPlan(account).then((view) => {
      if (live) setState(view ? { status: "ready", view } : { status: "failed" });
    });
    return () => {
      live = false;
    };
  }, [account, attempt]);
  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);
  return { state, retry };
}

// ─── Opening Stripe's customer portal ────────────────────────────────────────────────────────

export type PortalAnswer = { url: string } | { error: "noCustomer" | "failed" };

/** Asks our server for a portal session (`POST /api/billing/portal`); the customer is the server's to find. */
export async function requestPortal(locale: Locale): Promise<PortalAnswer> {
  try {
    const token = await accessToken();
    if (!token) return { error: "failed" };
    const response = await fetch("/api/billing/portal", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
      cache: "no-store",
    });
    if (response.status === 409) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      return { error: body?.error === "noCustomer" ? "noCustomer" : "failed" };
    }
    if (!response.ok) return { error: "failed" };
    const body = (await response.json()) as { url?: unknown };
    return typeof body.url === "string" ? { url: body.url } : { error: "failed" };
  } catch {
    return { error: "failed" };
  }
}

// ─── The pane ────────────────────────────────────────────────────────────────────────────────

const bdi = { bdi: (chunks: ReactNode) => <bdi>{chunks}</bdi> };

/**
 * The plan's name, where it comes from and its state: one row, then its dates. In the iPhone app (app
 * mode, ADR 0087) only the name, the state and the dates: the account's own plan, bought elsewhere, may
 * be named (App Store 3.1.3(b)), but nothing about where it comes from (no price, no Stripe, no invite
 * reward), no word about Pro coming and no nudge to pay: no past-due badge or note (a past-due account
 * shows no badge rather than a false "Aktiv"), since the app sells nothing and points to no purchase
 * (3.1.1, 3.1.3(f)). The states that ask for nothing stay: Aktiv, Gekündigt, Reserviert.
 */
function PlanGroup({ view }: { view: PlanView }) {
  const t = useTranslations("app.settings.plan");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const app = useAppMode();
  const day = (at: string) => format.dateTime(new Date(at), { day: "numeric", month: "long", year: "numeric" });
  const price = formatEuro(PRICES["pro-monthly"].amountCents, locale);
  const reserved = view.source === "reward" && !PRO_AVAILABLE;
  const badge =
    view.plan === "free" ? null : view.pastDue ? (
      app ? null : <Badge tone="danger">{t("status.pastDue")}</Badge>
    ) : view.source === "stripe" && view.endsAt ? (
      // A subscription the owner canceled (it runs to its end); a grant that simply ends is still active.
      <Badge>{t("status.ending")}</Badge>
    ) : reserved ? (
      <Badge>{t("status.reserved")}</Badge>
    ) : (
      <Badge tone="success">{t("status.active")}</Badge>
    );
  const footer = app
    ? undefined
    : view.pastDue
      ? t.rich("pastDue", bdi)
      : reserved
        ? t.rich("rewardSoon", bdi)
        : view.plan === "free" && !paymentsEnabled
          ? t.rich("soon", bdi)
          : undefined;
  return (
    <ListGroup title={t("groups.plan")} titleId="plan-current" footer={footer}>
      <ListRow
        icon={view.plan === "pro" ? icons.ai : icons.plan}
        title={<span className="font-semibold">{t.rich(`name.${view.plan}`, bdi)}</span>}
        // Where the plan comes from (a price, Stripe, the invite reward): not in the app.
        subtitle={app ? undefined : t.rich(`source.${view.source}`, { ...bdi, price })}
        subtitleWrap
        value={badge}
      />
      {view.renewsAt ? <ListRow icon={CalendarClock} title={t("renews", { date: day(view.renewsAt) })} /> : null}
      {view.endsAt ? <ListRow icon={CalendarClock} title={t(view.trial ? "trial" : "ends", { date: day(view.endsAt) })} /> : null}
    </ListGroup>
  );
}

/** What the plan holds. Only what is true today: the AI line only while drafts can be made. */
function IncludesGroup({ view, quota }: { view: PlanView; quota: AiQuotaView }) {
  const t = useTranslations("app.settings.plan");
  const items: string[] =
    view.plan === "pro"
      ? [t("includes.everything"), t("includes.proDrafts", { count: quota.quota?.plan === "pro" ? quota.quota.allowance : PRO_DRAFTS })]
      : [t("includes.page"), t("includes.blocks"), ...(quota.quota?.period === "life" ? [t("includes.freeDrafts", { count: quota.quota.allowance })] : [])];
  return (
    <ListGroup title={t("groups.includes")}>
      {items.map((item) => (
        <ListRow key={item} icon={Check} title={item} />
      ))}
    </ListGroup>
  );
}

/** AI drafts left, with the day new ones come (Pro), or why there are none right now. */
function AiGroup({ quota }: { quota: AiQuotaView }) {
  const t = useTranslations("app.settings.plan");
  const format = useFormatter();
  const { status, off } = quota;
  let body: ReactNode;
  if (status === "loading") {
    body = (
      <li className="grid gap-2 px-4 py-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-1 w-full rounded-full" />
      </li>
    );
  } else if (quota.quota) {
    const { left, allowance, period, resetsAt } = quota.quota;
    const words = t("ai.left", { left, allowance });
    body = (
      <li className="grid gap-3 px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="grid size-control-sm shrink-0 place-items-center rounded-sm bg-tinted text-tinted-fg">
            <Icon icon={icons.ai} size="sm" />
          </span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="text-body leading-snug font-semibold">{words}</span>
            <span className="text-small text-fg-secondary">
              {/* Drafts renew at midnight in Berlin (ADR 0065): that day, wherever the owner reads it. */}
              {period === "month" && resetsAt ? t("ai.resets", { date: format.dateTime(new Date(resetsAt), { day: "numeric", month: "long", timeZone: "Europe/Berlin" }) }) : t("ai.once")}
            </span>
          </span>
        </div>
        <ProgressBar value={left} max={allowance} label={t("ai.label")} valueText={words} />
      </li>
    );
  } else {
    body = (
      <>
        <ListRow icon={icons.ai} title={t(off === "demo" ? "ai.demo" : off === "disabled" ? "ai.disabled" : "ai.failed")} subtitleWrap />
        {off === "failed" ? <ListRow icon={icons.refresh} title={t("retry")} accessory="none" onClick={() => void quota.refresh()} /> : null}
      </>
    );
  }
  return (
    <ListGroup title={t("groups.ai")} titleId="plan-ai">
      {body}
    </ListGroup>
  );
}

const INVOICE_STATUS = new Set(["paid", "failed", "refunded"]);

/**
 * Only where contracts can be made (payments test or live): Stripe's portal for payment method and
 * invoices once Stripe knows the account, the newest invoices, "Pro holen" while the plan is Free,
 * and the statutory "Verträge hier kündigen" beside a running subscription.
 */
function BillingGroup({ view }: { view: PlanView }) {
  const t = useTranslations("app.settings.plan");
  const tRows = useTranslations("app.settings.rows");
  const tLegal = useTranslations("legal");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const [opening, setOpening] = useState(false);
  const price = formatEuro(PRICES["pro-monthly"].amountCents, locale);

  const portal = async () => {
    if (opening) return;
    setOpening(true);
    const answer = await requestPortal(locale);
    if ("url" in answer) {
      // Stripe's page replaces this one; the portal's "back" returns to this pane.
      window.location.assign(answer.url);
      return;
    }
    setOpening(false);
    toast({ title: t(answer.error === "noCustomer" ? "portalNoCustomer" : "portalFailed"), tone: "danger" });
  };

  return (
    <ListGroup title={t("groups.billing")} titleId="plan-billing" footer={paymentsMode === "test" ? tLegal("testMode") : undefined}>
      {view.plan === "free" ? (
        <ListRow
          icon={icons.ai}
          title={t.rich("upgrade", bdi)}
          subtitle={t.rich("upgradeHint", { ...bdi, price, count: PRO_DRAFTS })}
          subtitleWrap
          href="/checkout/pro"
        />
      ) : null}
      {view.customer ? (
        <ListRow
          icon={icons.billing}
          title={t("portal")}
          subtitle={t.rich("portalHint", bdi)}
          subtitleWrap
          accessory={opening ? <Spinner className="size-icon-sm text-fg-tertiary" /> : <Icon icon={icons.external} size="sm" className="text-fg-tertiary" />}
          onClick={() => void portal()}
        />
      ) : null}
      {/* One line each on a phone: the date in its short form, the state under it, the amount at the end. */}
      {view.invoices.map((invoice) => (
        <ListRow
          key={invoice.id}
          icon={icons.orders}
          title={t("invoice.title", { date: format.dateTime(new Date(invoice.at), { dateStyle: "medium" }) })}
          subtitle={INVOICE_STATUS.has(invoice.status) ? t(`invoice.${invoice.status as "paid" | "failed" | "refunded"}`) : undefined}
          value={<bdi>{formatEuro(invoice.amount_cents, locale)}</bdi>}
        />
      ))}
      {view.source === "stripe" ? <ListRow icon={FileX} title={tRows("cancel")} href="/kuendigen" /> : null}
    </ListGroup>
  );
}

/**
 * The pane's groups once the plan is known. In the iPhone app the plan's name and state, and the AI
 * drafts left (they name no plan, price or upgrade): no feature list, no payment group.
 */
export function PlanGroups({ view, quota }: { view: PlanView; quota: AiQuotaView }) {
  // The iPhone app shows no buying, no portal, no invoices and no cancellation (App Store 3.1.1, 3.1.3(f)).
  const app = useAppMode();
  return (
    <>
      <PlanGroup view={view} />
      {app ? null : <IncludesGroup view={view} quota={quota} />}
      <AiGroup quota={quota} />
      {paymentsEnabled && !app ? <BillingGroup view={view} /> : null}
    </>
  );
}

/** The pane while the plan loads, or after it could not be read. */
function PlanPlaceholder({ failed, retry }: { failed: boolean; retry: () => void }) {
  const t = useTranslations("app.settings.plan");
  if (failed) {
    return (
      <ListGroup title={t("groups.plan")} titleId="plan-current">
        <ListRow icon={icons.error} title={t("failed")} subtitleWrap />
        <ListRow icon={icons.refresh} title={t("retry")} accessory="none" onClick={retry} />
      </ListGroup>
    );
  }
  return (
    <div aria-busy className="grid gap-2">
      <Skeleton className="mx-4 h-4 w-24" />
      <Skeleton className="h-control-xl rounded-lg" />
    </div>
  );
}

/**
 * Plan (Settings › Plan): the plan and where it comes from, what it includes, the AI drafts left
 * and when new ones come, and, where contracts can be made, renewal, price, invoices and Stripe's
 * customer portal. Honest in every mode: the demo and production without payments say that Pro
 * comes with the launch and offer no button; a payments test build shows the portal (Stripe's
 * stand-in) and says no real money moves.
 */
export function PlanScreen() {
  const t = useTranslations("app.settings");
  const tApp = useTranslations("app");
  const { account } = useSite();
  const { state, retry } = usePlan(account.id);
  const quota = useAiQuota({ account: account.id, fresh: true });
  return (
    <Screen title={t("panes.plan")} back={{ href: SETTINGS_HREF, label: tApp("nav.settings") }} grow>
      {/* The groups stand in two columns where the column has the room (laptops), one below that. */}
      <ColumnGroups>
        {state.status === "ready" ? (
          <PlanGroups view={state.view} quota={quota} />
        ) : (
          <PlanPlaceholder failed={state.status === "failed"} retry={retry} />
        )}
      </ColumnGroups>
    </Screen>
  );
}

/** The Settings row that opens the pane, with the plan's name once it is known. */
export function PlanRow({ icon }: { icon: LucideIcon }) {
  const t = useTranslations("app.settings");
  const { account } = useSite();
  const { state } = usePlan(account.id);
  return (
    <ListRow
      icon={icon}
      title={t("panes.plan")}
      value={state.status === "ready" ? t.rich(`plan.name.${state.view.plan}`, bdi) : undefined}
      href="/app/settings/plan"
    />
  );
}
