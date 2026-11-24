"use client";

import { Badge, Button, ConfirmDialog, Icon, Skeleton, TextField, toast } from "@linkyo/ui";
import { AlarmClock, CircleAlert, CircleCheck, FileX2, Inbox, ShieldAlert, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { TextArea } from "@/features/app/form";
import { clockTime, shortDate, type EmailLocale } from "@/features/email/templates/render";
import { formatEuro } from "@/features/payments/prices";

import { bdi } from "../bidi";
import { useAdmin } from "../session";

import { actionsFor, contractEnded, NOTE_REQUIRED, parseCents, refundOpen, routeAction, type ContractAction } from "./contract-rules";
import { LoadFailed, useLoad } from "./load";
import { ApiError, decideContract, loadContracts, type ContractRequest } from "./orders-data";
import { slaChip } from "./sla";

export { actionsFor, parseCents } from "./contract-rules";

/** A deadline as a chip with words (and a tone as the second signal): queue, detail and this panel. */
export function SlaBadge({ due, now }: { due: string; now: Date }) {
  const t = useTranslations("admin.orders.sla");
  const chip = slaChip(new Date(due), now, (key, values) => t(key, values));
  return (
    <Badge size="sm" tone={chip.tone} data-sla={chip.state}>
      {chip.state === "ok" ? null : <Icon icon={chip.state === "overdue" ? CircleAlert : AlarmClock} size="sm" />}
      {chip.text}
    </Badge>
  );
}

const centsText = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/** Decisions that move money or end a contract at once. */
const WEIGHTY: ReadonlySet<ContractAction> = new Set(["acceptWithdrawal", "finishWithdrawal", "endNow"]);

function Decide({ item, action, onDone, onClose }: { item: ContractRequest; action: ContractAction; onDone: () => void; onClose: () => void }) {
  const t = useTranslations("admin.orders");
  const tKeep = useTranslations("admin.customer.confirm");
  const tErrors = useTranslations("legal.errors");
  const orderAmount = item.kind === "withdrawal" && item.order ? item.order.amountCents : null;
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState(orderAmount !== null ? centsText(orderAmount) : "");
  const [busy, setBusy] = useState(false);
  // The amount is set once, with the decision; finishing a refund sends the amount on record.
  const asksAmount = orderAmount !== null && action === "acceptWithdrawal";
  const cents = asksAmount ? parseCents(amount) : null;
  const amountInvalid = orderAmount !== null && action === "acceptWithdrawal" && (cents === null || cents > orderAmount);
  const needsNote = NOTE_REQUIRED.has(action);
  const noteMissing = needsNote && note.trim() === "";
  const hint = action === "finishWithdrawal" ? t.rich("actions.finishWithdrawalHint", { bdi }) : action === "schedule" ? t.rich("actions.scheduleHint", { bdi }) : null;

  const confirm = async () => {
    setBusy(true);
    try {
      const answer = await decideContract(item.kind, item.id, { action: routeAction(action), ...(note.trim() ? { note: note.trim() } : {}), ...(cents !== null ? { refundCents: cents } : {}) });
      if (answer.mailed === false) toast({ title: t("mailFailed"), tone: "danger" });
      else toast({ title: WEIGHTY.has(action) && item.kind === "withdrawal" ? t("refunded") : t("contracts.handled"), tone: "success" });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "server";
      toast({ title: code === "noteRequired" ? t("actions.noteRequired") : code === "locked" ? t("changed") : tErrors("server"), tone: "danger" });
    } finally {
      setBusy(false);
      // Also after a failure: a decision may be on record although its Stripe step failed, and the
      // list must show what can be done now (finish the refund), not what could be done before.
      onDone();
    }
  };

  const subject = item.kind === "withdrawal" ? (item.order?.number ?? item.contract) : item.accountEmail;
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(`actions.${action}`)}
      description={
        <span className="grid gap-2">
          <bdi dir="ltr">{subject}</bdi>
          {hint ? <span>{hint}</span> : null}
        </span>
      }
      confirmLabel={t(`actions.${action}`)}
      cancelLabel={tKeep("keep")}
      destructive={WEIGHTY.has(action)}
      loading={busy}
      confirmDisabled={noteMissing || amountInvalid}
      initialFocus="first-field"
      onConfirm={() => void confirm()}
    >
      {asksAmount ? (
        <TextField
          label={t("actions.refundAmount")}
          hint={t.rich("actions.refundAmountHint", { bdi })}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          ltr
          trailing={<span className="text-fg-secondary">€</span>}
          error={amountInvalid ? tErrors("required") : undefined}
        />
      ) : null}
      <TextArea
        label={action === "resume" ? t("actions.resumeNote") : t("actions.note")}
        hint={needsNote ? t("actions.noteRequired") : undefined}
        value={note}
        onValue={setNote}
        max={2000}
        rows={3}
        required={needsNote}
      />
    </ConfirmDialog>
  );
}

function Item({ item, now, onChanged }: { item: ContractRequest; now: Date; onChanged: () => void }) {
  const t = useTranslations("admin.orders");
  const tStatus = useTranslations("orders.status");
  const locale = useLocale() as EmailLocale;
  const { can } = useAdmin();
  const [pending, setPending] = useState<ContractAction | null>(null);
  const received = new Date(item.receivedAt);
  const actions = can("billing.manage") ? actionsFor(item) : [];
  const contract = item.kind === "withdrawal" ? (item.order ? item.order.number : item.entitlement ? "Linkyo Pro" : item.contract) : "Linkyo Pro";
  const open = refundOpen(item);
  const ended = item.kind === "withdrawal" && !item.handledAt && item.decision === null && item.matched && contractEnded(item);

  return (
    <li data-contract={item.kind} data-contract-id={item.id} className="grid gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge size="sm" tone={item.kind === "withdrawal" ? "warning" : "primary"}>
          <Icon icon={FileX2} size="sm" />
          {t(`contracts.${item.kind}`)}
        </Badge>
        <Badge size="sm" tone={item.matched ? "success" : "outline"}>
          {item.matched ? t("contracts.matched") : t("contracts.unmatched")}
        </Badge>
        {item.handledAt ? (
          <Badge size="sm" tone="neutral">
            <Icon icon={CircleCheck} size="sm" />
            {t("contracts.handled")}
          </Badge>
        ) : null}
        {open ? (
          <Badge size="sm" tone="danger" data-refund-open>
            <Icon icon={CircleAlert} size="sm" />
            {t("contracts.refundOpen")}
          </Badge>
        ) : null}
        {item.kind === "withdrawal" && item.order ? <Badge size="sm">{tStatus(item.order.status)}</Badge> : null}
      </div>
      <p className="text-small text-fg-secondary">{t("contracts.received", { date: shortDate(received, locale), time: clockTime(received, locale) })}</p>
      {item.suspect ? (
        <p className="flex items-start gap-2 rounded-md bg-warning-subtle px-3 py-2 text-small text-warning-strong">
          <Icon icon={ShieldAlert} size="sm" className="mt-0.5 shrink-0" />
          {t("contracts.suspect")}
        </p>
      ) : null}
      {ended ? (
        <p data-contract-ended className="text-small text-fg-secondary">
          {t("contracts.contractEnded")}
        </p>
      ) : item.kind === "withdrawal" && !item.handledAt && item.matched ? (
        // Shown until the refund is on record: an accepted withdrawal still has its 14 days to meet.
        <p className="flex flex-wrap items-center gap-2 text-small">
          <span data-refund-due>{t("contracts.refundDue", { date: shortDate(new Date(item.refundDueAt), locale) })}</span>
          <SlaBadge due={item.refundDueAt} now={now} />
        </p>
      ) : null}
      <dl className="grid gap-1 text-small sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
        <dt className="text-fg-secondary">{t("cols.number")}</dt>
        <dd className="min-w-0 font-medium">
          <bdi>{contract}</bdi>
          {item.kind === "withdrawal" && item.order ? (
            <span className="text-fg-secondary"> · {formatEuro(open && item.refundCents !== null ? item.refundCents : item.order.amountCents, locale)}</span>
          ) : null}
        </dd>
        <dt className="text-fg-secondary">{t("cols.customer")}</dt>
        <dd className="flex min-w-0 items-center gap-1">
          <Icon icon={UserRound} size="sm" className="shrink-0 text-fg-secondary" />
          <bdi className="truncate">{item.name}</bdi>
          <span dir="ltr" className="truncate text-fg-secondary">
            {item.kind === "withdrawal" ? item.email : item.accountEmail}
          </span>
        </dd>
        {item.kind === "cancellation" && item.reason ? (
          <>
            <dt className="text-fg-secondary">{t("actions.note")}</dt>
            <dd dir="auto" className="min-w-0 break-words">
              {item.reason}
            </dd>
          </>
        ) : null}
        {item.note ? (
          <>
            <dt className="text-fg-secondary">{t("events.note")}</dt>
            <dd dir="auto" className="min-w-0 break-words">
              {item.note}
            </dd>
          </>
        ) : null}
      </dl>
      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action}
              size="sm"
              data-contract-action={action}
              variant={WEIGHTY.has(action) || action === "schedule" ? "primary" : action === "handled" ? "ghost" : "secondary"}
              onClick={() => setPending(action)}
            >
              {t(`actions.${action}`)}
            </Button>
          ))}
        </div>
      ) : null}
      {pending ? (
        <Decide
          item={item}
          action={pending}
          onClose={() => setPending(null)}
          onDone={() => {
            setPending(null);
            onChanged();
          }}
        />
      ) : null}
    </li>
  );
}

/**
 * Withdrawals and cancellations (the second tab of the orders screen): unhandled first, each with
 * when it arrived, whether it matched an account, a held receipt, and for withdrawals the 14-day
 * refund deadline as an SLA chip. Decisions open a confirm dialog; most need a reason. A list that
 * could not be loaded says so (it is never shown as "no open requests").
 */
export function ContractsPanel({ now }: { now: Date }) {
  const t = useTranslations("admin.orders.contracts");
  // Each decision reads the list again.
  const { state, reload, refresh } = useLoad(loadContracts, "contracts");

  if (state.status === "loading") {
    return (
      <div className="grid gap-3" aria-hidden>
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }
  if (state.status === "failed") return <LoadFailed onRetry={reload} />;
  const items = state.data;
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-line bg-surface p-4 text-small text-fg-secondary">
        <Icon icon={Inbox} size="sm" />
        {t("empty")}
      </p>
    );
  }
  return (
    <ul data-contracts className="grid gap-3">
      {items.map((item) => (
        <Item key={`${item.kind}:${item.id}`} item={item} now={now} onChanged={() => void refresh()} />
      ))}
    </ul>
  );
}
