"use client";

import { Badge, Button, ConfirmDialog, Icon, Skeleton, toast } from "@linkyo/ui";
import { ArrowLeft, CircleAlert, ExternalLink, Pencil, PenTool, Send, Sparkles, Undo2, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { isLive } from "@/features/ai/run-reducer";
import { AiRunView } from "@/features/ai/run-view";
import { useAiRun } from "@/features/ai/use-ai-run";
import { Panel } from "@/features/app/screen";
import { clockTime, shortDate, type EmailLocale } from "@/features/email/templates/render";
import { formatEuro } from "@/features/payments/prices";
import { Link } from "@/i18n/navigation";
import { browserSupabase } from "@/lib/supabase/browser";

import { useAdmin } from "../session";

import { SlaBadge } from "./contracts-panel";
import { ApiError, assignToMe, deliverProposal, kitComplete, loadOrder, refundOrder, signedUrls, type OrderEvent, type TeamOrder, type TeamProposal } from "./orders-data";
import { PackageBadge, StatusBadge, useMinuteClock, WithdrawalBadge } from "./orders-screen";
import { partialRefund } from "./team-words";

/** The draft of the current round (round = revisions used), if there is one. */
export function currentDraft(order: TeamOrder): TeamProposal | null {
  return order.proposals.find((proposal) => proposal.round === order.revisionsUsed && proposal.status === "draft") ?? null;
}

const CLOSED = new Set(["refunded", "withdrawn"]);
const consoleLink = "inline-flex min-h-touch-target items-center gap-2 rounded-sm text-small font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring";

function When({ at }: { at: string }) {
  const locale = useLocale() as EmailLocale;
  const date = new Date(at);
  return (
    <time dateTime={at} className="tabular-nums">
      {shortDate(date, locale)} · {clockTime(date, locale)}
    </time>
  );
}

function Briefing({ order }: { order: TeamOrder }) {
  const t = useTranslations("admin.orders.detail");
  const tLocales = useTranslations("admin.locales");
  const [photos, setPhotos] = useState<Map<string, string>>(new Map());
  const paths = order.briefing?.photos ?? [];
  const key = paths.join("|");
  useEffect(() => {
    if (!key) return;
    void signedUrls("briefing", key.split("|")).then(setPhotos);
  }, [key]);
  if (!order.briefing) {
    return (
      <Panel title={t("briefing")}>
        <p className="text-small text-fg-secondary">{t("noBriefing")}</p>
      </Panel>
    );
  }
  const briefing = order.briefing;
  return (
    <Panel title={t("briefing")}>
      <dl className="grid gap-4 text-small">
        <div className="grid gap-1">
          <dt className="font-semibold">{t("links")}</dt>
          <dd>
            <ul className="grid gap-1">
              {briefing.links.map((link) => (
                <li key={link} className="min-w-0 break-all">
                  <bdi dir="ltr">{link}</bdi>
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div className="grid gap-1">
          <dt className="font-semibold">{t("wishes")}</dt>
          <dd dir="auto" className="whitespace-pre-line break-words text-fg-secondary">
            {briefing.wishes || "–"}
          </dd>
        </div>
        <div className="grid gap-1">
          <dt className="font-semibold">{t("language")}</dt>
          <dd className="text-fg-secondary">{tLocales(briefing.pageLocale)}</dd>
        </div>
        {paths.length > 0 ? (
          <div className="grid gap-2">
            <dt className="font-semibold">{t("photos")}</dt>
            <dd>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {paths.map((path, index) => (
                  <li key={path} className="aspect-square overflow-hidden rounded-md border border-line bg-canvas-muted">
                    {photos.get(path) ? (
                      <a href={photos.get(path)} target="_blank" rel="noreferrer" className="block size-full focus-visible:focus-ring">
                        {/* eslint-disable-next-line @next/next/no-img-element -- a signed address of a private picture (10 minutes) */}
                        <img src={photos.get(path)} alt={`${t("photos")} ${String(index + 1)}`} className="size-full object-cover" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
    </Panel>
  );
}

function Proposals({ order }: { order: TeamOrder }) {
  const t = useTranslations("admin.orders.detail");
  const tEvents = useTranslations("admin.orders.events");
  const tReview = useTranslations("app.ai.review");
  return (
    <Panel title={t("proposals")}>
      <p className="text-small text-fg-secondary">{t("revisions", { used: order.revisionsUsed, allowed: order.revisionsAllowed })}</p>
      {order.proposals.length > 0 ? (
        <ul className="grid gap-2">
          {order.proposals.map((proposal) => (
            <li key={proposal.id} data-proposal-round={proposal.round} data-proposal-status={proposal.status} className="grid gap-2 rounded-md border border-line p-3">
              <span className="flex flex-wrap items-center gap-2 text-small">
                <span className="font-semibold">{t("round", { round: proposal.round + 1 })}</span>
                <Badge size="sm" tone={proposal.status === "draft" ? "warning" : proposal.status === "superseded" ? "neutral" : "success"}>
                  {proposal.status === "draft" ? tReview("after") : proposal.status === "applied" ? tEvents("proposal_applied") : tEvents("proposal_delivered")}
                </Badge>
                {proposal.aiAssisted ? <Icon icon={Sparkles} size="sm" className="text-fg-secondary" /> : <Icon icon={PenTool} size="sm" className="text-fg-secondary" />}
                {proposal.deliveredAt ? (
                  <span className="text-fg-secondary">
                    <When at={proposal.deliveredAt} />
                  </span>
                ) : null}
              </span>
              {proposal.request ? (
                <p className="grid gap-1 text-small">
                  <span className="font-semibold">{t("request")}</span>
                  <span dir="auto" className="whitespace-pre-line break-words text-fg-secondary">
                    {proposal.request}
                  </span>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

function Timeline({ order }: { order: TeamOrder }) {
  const t = useTranslations("admin.orders");
  const locale = useLocale() as EmailLocale;
  const label = (event: OrderEvent) => {
    const partial = partialRefund(event);
    if (partial) return t("events.refunded_partial", { amount: formatEuro(partial.amountCents, locale) });
    return t.has(`events.${event.kind}`) ? t(`events.${event.kind}`) : event.kind;
  };
  return (
    <Panel title={t("detail.timeline")}>
      <ol className="grid gap-3">
        {order.events.map((event) => (
          <li key={event.id} data-event={event.kind} className="grid gap-0.5 border-s border-line-strong ps-3 text-small">
            <span className="font-medium">{label(event)}</span>
            <span className="text-caption text-fg-secondary">
              <When at={event.at} />
              {event.actor ? (
                <>
                  {" · "}
                  <span dir="ltr">{event.actor}</span>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function RefundButton({ order, onDone }: { order: TeamOrder; onDone: () => void }) {
  const t = useTranslations("admin.orders");
  const tKeep = useTranslations("admin.customer.confirm");
  const tErrors = useTranslations("legal.errors");
  const locale = useLocale() as EmailLocale;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [voluntaryUsed, setVoluntaryUsed] = useState(false);
  const openDialog = async () => {
    const { data } = await browserSupabase().rpc("admin_order_refund_target", { target: order.id });
    setVoluntaryUsed(Boolean(data && typeof data === "object" && !Array.isArray(data) && data.voluntaryUsed === true));
    setOpen(true);
  };
  const refund = async () => {
    setBusy(true);
    try {
      await refundOrder(order.id);
      toast({ title: t("refunded"), tone: "success" });
      onDone();
    } catch {
      toast({ title: tErrors("server"), tone: "danger" });
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };
  return (
    <>
      <Button variant="secondary" onClick={() => void openDialog()}>
        <Icon icon={Undo2} size="sm" />
        {t("actions.refund")}
      </Button>
      {open ? (
        <ConfirmDialog
          open
          onOpenChange={setOpen}
          title={t("actions.refund")}
          description={
            <span className="grid gap-2">
              <span>{t("actions.refundConfirm", { price: formatEuro(order.amountCents, locale), number: order.number })}</span>
              {voluntaryUsed ? <span data-voluntary-used className="font-semibold text-fg">{t("actions.refundVoluntaryUsed")}</span> : null}
            </span>
          }
          confirmLabel={t("actions.refund")}
          cancelLabel={tKeep("keep")}
          loading={busy}
          onConfirm={() => void refund()}
        />
      ) : null}
    </>
  );
}

/**
 * One order for the team (`/admin/orders/<id>`): briefing, proposals and timeline, and the actions —
 * assign, an AI draft for Start (the team's own run, saved as the round's proposal), edit, deliver
 * and refund. A withdrawal waiting for a decision stops the work. Nothing here changes the customer's
 * page: only the customer applies a proposal.
 */
export function OrderDetailScreen({ orderId }: { orderId: string }) {
  const t = useTranslations("admin.orders");
  const tAiErrors = useTranslations("app.ai.errors");
  const tErrors = useTranslations("legal.errors");
  const tCommon = useTranslations("common");
  const locale = useLocale() as EmailLocale;
  const { can, me } = useAdmin();
  const now = useMinuteClock();
  const [order, setOrder] = useState<TeamOrder | null | undefined>(undefined);
  const [busy, setBusy] = useState<"assign" | "deliver" | null>(null);
  const { state, start, stop, reset } = useAiRun({ endpoint: `/api/admin/orders/${orderId}/ai` });

  const load = useCallback(async () => {
    try {
      setOrder(await loadOrder(orderId));
    } catch {
      setOrder(null);
    }
  }, [orderId]);
  useEffect(() => {
    let cancelled = false;
    void loadOrder(orderId)
      .catch(() => null)
      .then((next) => {
        if (!cancelled) setOrder(next);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // The team's draft is saved as the round's proposal before `done` arrives: say so, and read the
  // order again (the run view gives way to the proposals list).
  const savedRun = state.phase === "review" ? (state.result?.runId ?? null) : null;
  useEffect(() => {
    if (!savedRun) return;
    toast({ title: t("events.proposal_saved"), tone: "success" });
    void loadOrder(orderId)
      .catch(() => null)
      .then((next) => {
        if (next) setOrder(next);
      });
  }, [savedRun, orderId, t]);

  if (order === undefined) {
    return (
      <div className="mx-auto grid max-w-content gap-4 px-4 pt-6 md:px-8" aria-hidden>
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }
  if (order === null) {
    return (
      <div className="mx-auto grid max-w-content gap-4 px-4 pt-6 md:px-8">
        <Link href="/admin/orders" className={consoleLink}>
          <Icon icon={ArrowLeft} size="sm" className="rtl:-scale-x-100" />
          {t("title")}
        </Link>
        <p className="text-small text-fg-secondary">{t("empty")}</p>
      </div>
    );
  }

  const editor = can("pages.edit");
  const locked = order.withdrawalPending || CLOSED.has(order.status);
  const draft = currentDraft(order);
  const incomplete = order.package === "premium" && draft !== null && !kitComplete(draft.extras, draft.storyPaths);
  const mine = order.assignee?.label.toLowerCase() === me.email.toLowerCase();
  const running = isLive(state);
  const due = order.revisionDueAt ?? order.dueAt ?? order.promisedDueAt;
  const open = !["delivered", "completed", "refunded", "withdrawn"].includes(order.status);

  const assign = async () => {
    setBusy("assign");
    try {
      await assignToMe(order.id);
      await load();
    } catch {
      toast({ title: tErrors("server"), tone: "danger" });
    } finally {
      setBusy(null);
    }
  };
  const deliver = async () => {
    if (!draft) return;
    setBusy("deliver");
    try {
      await deliverProposal(order.id, draft.id);
      toast({ title: t("delivered"), tone: "success" });
      await load();
    } catch (error) {
      toast({ title: error instanceof ApiError && error.code === "incomplete" ? t("kit.incomplete") : tErrors("server"), tone: "danger" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-content grid-cols-1 gap-6 px-4 pt-6 pb-10 md:px-8 lg:pt-10">
      <header className="grid gap-3">
        <Link href="/admin/orders" className={consoleLink}>
          <Icon icon={ArrowLeft} size="sm" className="rtl:-scale-x-100" />
          {t("title")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-h2 tracking-tight tabular-nums rtl:tracking-normal">
            <bdi>{order.number}</bdi>
          </h1>
          <PackageBadge value={order.package} />
          <StatusBadge status={order.status} />
          {order.withdrawalPending ? <WithdrawalBadge /> : due && open ? <SlaBadge due={due} now={now} /> : null}
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-fg-secondary">
          {order.customer.username ? <span dir="ltr">@{order.customer.username}</span> : null}
          <span dir="ltr">{order.customer.email}</span>
          <span>{formatEuro(order.amountCents, locale)}</span>
          <span>
            {t("cols.assignee")}: {order.assignee ? <span dir="ltr">{order.assignee.label}</span> : t("unassigned")}
          </span>
        </p>
      </header>

      {order.withdrawalPending ? (
        <p role="note" data-withdrawal-lock className="flex items-start gap-2 rounded-md border border-line-strong bg-danger-subtle px-4 py-3 text-small text-danger-strong">
          <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0" />
          {t("detail.withdrawalLock")}
        </p>
      ) : null}

      {editor || can("billing.manage") ? (
        <div data-order-actions className="flex flex-wrap gap-2">
          {editor ? (
            <>
              <Button variant={order.assignee ? "secondary" : "primary"} disabled={locked || mine} loading={busy === "assign"} onClick={() => void assign()}>
                <Icon icon={UserPlus} size="sm" />
                {t("actions.assign")}
              </Button>
              {order.package === "start" ? (
                <Button
                  variant="secondary"
                  disabled={locked || running || !order.briefing || (draft === null && order.proposals.some((proposal) => proposal.round === order.revisionsUsed))}
                  onClick={() => start({ pageLocale: order.briefing?.pageLocale ?? order.locale })}
                >
                  <Icon icon={Sparkles} size="sm" />
                  {t("actions.ai")}
                </Button>
              ) : null}
              {locked ? (
                <Button variant="secondary" disabled>
                  <Icon icon={Pencil} size="sm" />
                  {t("actions.edit")}
                </Button>
              ) : (
                <Button asChild variant="secondary">
                  <Link href={`/admin/orders/${order.id}/proposal`}>
                    <Icon icon={Pencil} size="sm" />
                    {t("actions.edit")}
                  </Link>
                </Button>
              )}
              <Button variant="primary" disabled={locked || draft === null || incomplete || running} loading={busy === "deliver"} onClick={() => void deliver()}>
                <Icon icon={Send} size="sm" />
                {t("actions.deliver")}
              </Button>
            </>
          ) : null}
          {can("billing.manage") && !CLOSED.has(order.status) ? <RefundButton order={order} onDone={() => void load()} /> : null}
        </div>
      ) : null}
      {incomplete ? <p className="text-small text-fg-secondary">{t("kit.incomplete")}</p> : null}

      {state.phase !== "input" && state.phase !== "review" ? (
        <section className="grid gap-3 rounded-lg border border-line bg-surface">
          <AiRunView
            state={state}
            source="live"
            tone="brand"
            announce
            onStop={running ? stop : undefined}
            owner={{ username: order.customer.username ?? "draft", name: order.customer.name ?? undefined }}
            stickyStrip={false}
          />
          {state.phase === "error" || state.phase === "stopped" ? (
            <div className="flex flex-wrap items-center gap-3 px-4 pb-4">
              {state.error ? (
                <p role="alert" className="text-small text-danger-strong">
                  {tAiErrors(state.error)}
                </p>
              ) : null}
              <Button variant="ghost" size="sm" onClick={reset}>
                {tCommon("close")}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-6">
          <Briefing order={order} />
          <Proposals order={order} />
        </div>
        <div className="grid content-start gap-6">
          <Timeline order={order} />
          {order.customer.username ? (
            <Link href={`/admin/customers/${order.customer.id ?? ""}`} className={consoleLink}>
              <Icon icon={ExternalLink} size="sm" />
              <span dir="ltr">@{order.customer.username}</span>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
