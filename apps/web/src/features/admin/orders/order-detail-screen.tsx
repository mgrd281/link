"use client";

import { Badge, Button, ConfirmDialog, Icon, Skeleton, toast } from "@linkyo/ui";
import { ArrowLeft, CircleAlert, ExternalLink, Pencil, PenTool, Send, Sparkles, Undo2, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { isLive } from "@/features/ai/run-reducer";
import { AiRunView } from "@/features/ai/run-view";
import { useAiRun } from "@/features/ai/use-ai-run";
import { Panel } from "@/features/app/screen";
import { clockTime, shortDate, type EmailLocale } from "@/features/email/templates/render";
import { formatEuro } from "@/features/payments/prices";
import { Link } from "@/i18n/navigation";
import { browserSupabase } from "@/lib/supabase/browser";
import { useSignedUrls } from "@/lib/supabase/signed";

import { bdi, isolate } from "../bidi";
import { useAdmin } from "../session";

import { SlaBadge } from "./contracts-panel";
import { LoadFailed, useLoad } from "./load";
import { aiStart, currentDraft, orderLocked, refundState } from "./order-rules";
import { ApiError, assignToMe, deliverProposal, kitComplete, loadOrder, refundOrder, type OrderEvent, type TeamOrder } from "./orders-data";
import { PackageBadge, StatusBadge, useMinuteClock, WithdrawalBadge } from "./orders-screen";
import { partialRefund } from "./team-words";

export { currentDraft } from "./order-rules";

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
  const paths = order.briefing?.photos ?? [];
  // The thumbnails keep their first address; the full-size links are signed again while the screen is open.
  const photos = useSignedUrls("briefing", paths);
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
                    {photos.first.get(path) ? (
                      <a href={photos.fresh.get(path) ?? photos.first.get(path)} target="_blank" rel="noreferrer" className="block size-full focus-visible:focus-ring">
                        {/* eslint-disable-next-line @next/next/no-img-element -- a signed address of a private picture (10 minutes) */}
                        <img src={photos.first.get(path)} alt={`${t("photos")} ${String(index + 1)}`} className="size-full object-cover" />
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
                  <span dir="ltr" data-event-actor>
                    {event.actor}
                  </span>
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
  const tBilling = useTranslations("admin.customer.billingErrors");
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
      const answer = await refundOrder(order.id);
      toast(answer.mailed === false ? { title: t("mailFailed"), tone: "danger" } : { title: t("refunded"), tone: "success" });
    } catch (error) {
      // "locked": a withdrawal arrived, or someone else refunded it, while this screen was open.
      // "notAvailable": the database lacks the refund function yet; nothing was sent to Stripe.
      const code = error instanceof ApiError ? error.code : "";
      toast({ title: code === "locked" ? t("changed") : code === "notAvailable" ? tBilling("notAvailable") : tErrors("server"), tone: "danger" });
    } finally {
      setBusy(false);
      setOpen(false);
      onDone();
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
              <span>{t.rich("actions.refundConfirm", { price: formatEuro(order.amountCents, locale), number: order.number, bdi })}</span>
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
 * and refund. A withdrawal waiting for a decision stops the work, the refund included: it is decided
 * in the contracts tab. Nothing here changes the customer's page: only the customer applies a proposal.
 */
export function OrderDetailScreen({ orderId }: { orderId: string }) {
  const t = useTranslations("admin.orders");
  const tAiErrors = useTranslations("app.ai.errors");
  const tErrors = useTranslations("legal.errors");
  const tCommon = useTranslations("common");
  const tKeep = useTranslations("admin.customer.confirm");
  const locale = useLocale() as EmailLocale;
  const { can, me } = useAdmin();
  const now = useMinuteClock();
  const { state: loaded, reload, refresh } = useLoad(() => loadOrder(orderId), orderId);
  const [busy, setBusy] = useState<"assign" | "deliver" | null>(null);
  const [confirmAi, setConfirmAi] = useState(false);
  const { state, start, stop, reset } = useAiRun({ endpoint: `/api/admin/orders/${orderId}/ai` });

  // The team's draft is saved as the round's proposal before `done` arrives: say so, and read the
  // order again (the run view gives way to the proposals list).
  const savedRun = state.phase === "review" ? (state.result?.runId ?? null) : null;
  useEffect(() => {
    if (!savedRun) return;
    toast({ title: t("events.proposal_saved"), tone: "success" });
    void refresh();
  }, [savedRun, refresh, t]);

  if (loaded.status === "loading") {
    return (
      <div className="mx-auto grid max-w-content gap-4 px-4 pt-6 md:px-8" aria-hidden>
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }
  const order = loaded.status === "ready" ? loaded.data : null;
  if (order === null) {
    return (
      <div className="mx-auto grid max-w-content gap-4 px-4 pt-6 md:px-8">
        <Link href="/admin/orders" className={consoleLink}>
          <Icon icon={ArrowLeft} size="sm" />
          {t("title")}
        </Link>
        {/* An order that could not be read is not "no such order". */}
        {loaded.status === "failed" ? <LoadFailed onRetry={reload} /> : <p className="text-small text-fg-secondary">{t("empty")}</p>}
      </div>
    );
  }

  const editor = can("pages.edit");
  const locked = orderLocked(order);
  const draft = currentDraft(order);
  const incomplete = order.package === "premium" && draft !== null && !kitComplete(draft.extras, draft.storyPaths);
  const mine = order.assignee?.label.toLowerCase() === me.email.toLowerCase();
  const running = isLive(state);
  const due = order.revisionDueAt ?? order.dueAt ?? order.promisedDueAt;
  const open = !["delivered", "completed", "refunded", "withdrawn"].includes(order.status);
  const ai = aiStart(order);
  const refund = can("billing.manage") ? refundState(order) : "closed";
  const startAi = () => start({ pageLocale: order.briefing?.pageLocale ?? order.locale });

  const assign = async () => {
    setBusy("assign");
    try {
      await assignToMe(order.id);
      await refresh();
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
      const answer = await deliverProposal(order.id, draft.id);
      // The route says whether the e-mail went out; never promise one that did not.
      toast(answer.mailed === false ? { title: t("deliveredNoMail"), tone: "danger" } : { title: t("delivered"), tone: "success" });
      await refresh();
    } catch (error) {
      toast({ title: error instanceof ApiError && error.code === "incomplete" ? t.markup("kit.incomplete", { bdi: isolate }) : tErrors("server"), tone: "danger" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-content grid-cols-1 gap-6 px-4 pt-6 pb-10 md:px-8 lg:pt-10">
      <header className="grid gap-3">
        <Link href="/admin/orders" className={consoleLink}>
          <Icon icon={ArrowLeft} size="sm" />
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

      {editor || refund !== "closed" ? (
        <div data-order-actions className="flex flex-wrap gap-2">
          {editor ? (
            <>
              <Button variant={order.assignee ? "secondary" : "primary"} disabled={locked || mine} loading={busy === "assign"} onClick={() => void assign()}>
                <Icon icon={UserPlus} size="sm" />
                {t("actions.assign")}
              </Button>
              {order.package === "start" ? (
                <Button variant="secondary" disabled={running || ai === "blocked"} onClick={() => (ai === "confirm" ? setConfirmAi(true) : startAi())}>
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
          {refund === "open" ? (
            <RefundButton order={order} onDone={() => void refresh()} />
          ) : refund === "withdrawal" ? (
            // The refund of a withdrawal is decided in the contracts tab; from here it would be booked as the voluntary money-back.
            <Button variant="secondary" disabled aria-describedby="refund-locked">
              <Icon icon={Undo2} size="sm" />
              {t("actions.refund")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {refund === "withdrawal" ? (
        <p id="refund-locked" data-refund-locked className="text-small text-fg-secondary">
          {t("actions.refundLocked")}
        </p>
      ) : null}
      {incomplete ? <p className="text-small text-fg-secondary">{t.rich("kit.incomplete", { bdi })}</p> : null}
      {confirmAi ? (
        <ConfirmDialog
          open
          onOpenChange={setConfirmAi}
          title={t("actions.aiReplaceTitle")}
          description={t("actions.aiReplaceBody")}
          confirmLabel={t("actions.ai")}
          cancelLabel={tKeep("keep")}
          onConfirm={() => {
            setConfirmAi(false);
            startAi();
          }}
        />
      ) : null}

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
