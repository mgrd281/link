"use client";

import { Badge, Button, cn, ConfirmDialog, Icon, Segmented, Spinner, toast } from "@linkyo/ui";
import { ArrowRight, BadgeCheck, ExternalLink, Lock, SearchCheck, UserCheck, UserX, X, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { useAccount } from "@/features/account/store";
import { SelectField, TextArea } from "@/features/app/form";
import { Panel, Screen } from "@/features/app/screen";
import { REFERRAL_RULES } from "@/features/referrals/rules";
import { referralTeam, useReferralQueue } from "@/features/referrals/team";
import type { DeclineReason, HeldInvite, QueueVerification, ReferralReason, ReferralSignals } from "@/features/referrals/types";
import { Link } from "@/i18n/navigation";
import { touchSegmented } from "@/lib/touch";

import { count, date } from "./format";
import { bdi, isolate } from "./bidi";
import { useAdmin } from "./session";

/*
 * The team's side of the invite program (ADR 0064): verification requests to decide (the blue check
 * stays a person's decision) and invites the server held back to check. Rewards are never revenue.
 */

export const DECLINE_REASONS: readonly DeclineReason[] = ["profileNotLinked", "identityUnclear", "impersonation", "other"];
const SIGNALS = ["sameNetwork", "sameSignature", "cluster", "disposable", "emailLink"] as const;
/** The longest reason the database keeps for the activity log. */
export const WHY_MAX = 200;

/** "Decline …" opens a dialog; inside it the same word confirms, without the ellipsis. */
export const bare = (label: string) => label.replace(/\s*…$/u, "");

/** Only real https profile links become links (the database accepts nothing else; this is belt and braces). */
const PROFILE_LINK = /^https:\/\/[^\s/]+\.\S+$/;

/** "@username", linked to the customer; "–" for an account that is gone. */
export function CustomerLink({ id, username }: { id: string | null; username: string | null }) {
  const t = useTranslations("admin.customer.invites");
  if (!id || !username) return <span className="text-fg-tertiary">{t("none")}</span>;
  return (
    <Link
      href={`/admin/customers/${id}`}
      className="min-w-0 rounded-sm font-semibold break-all text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring"
    >
      <span dir="ltr">@{username}</span>
    </Link>
  );
}

/** Why the server held (or refused) an invite, in words. */
export function useReasonLabel() {
  const t = useTranslations("admin.referrals.reasons");
  return (reason: ReferralReason) => t(reason, { days: REFERRAL_RULES.clusterDays });
}

/** One outline chip per check that fired (yes/no only: no addresses or fingerprints are kept). */
export function SignalChips({ signals }: { signals: ReferralSignals }) {
  const t = useTranslations("admin.referrals.signals");
  const on = SIGNALS.filter((key) => signals[key]);
  if (!on.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {on.map((key) => (
        <Badge key={key} size="sm" tone="outline">
          {t(key)}
        </Badge>
      ))}
    </span>
  );
}

/** The official profiles a creator sent, opened in a new tab, always left to right. */
export function ProfileLinks({ links }: { links: readonly string[] }) {
  return (
    <ul className="grid grid-cols-1 gap-1">
      {links.map((link) => (
        <li key={link} className="min-w-0 text-small">
          {PROFILE_LINK.test(link) ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="inline-flex max-w-full items-center gap-1 rounded-sm font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring"
            >
              <span className="min-w-0 break-all">{link.replace(/^https:\/\//, "")}</span>
              <Icon icon={ExternalLink} size="sm" className="shrink-0" />
            </a>
          ) : (
            <span dir="ltr" className="break-all text-fg-secondary">
              {link}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** A calm, honest "nothing here" box, as elsewhere in the console. */
function Empty({ icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-xl border border-dashed border-line-strong p-8 text-center">
      <Icon icon={icon} size="lg" className="text-fg-tertiary" />
      <p className="text-body text-fg-secondary">{text}</p>
    </div>
  );
}

function VerificationCard({
  request,
  canVerify,
  own,
  onApprove,
  onDecline,
}: {
  request: QueueVerification;
  canVerify: boolean;
  /** The reviewer's own request: someone else on the team decides it (the database refuses it too). */
  own: boolean;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const t = useTranslations("admin.referrals.verifications");
  const tCustomer = useTranslations("admin.customer");
  const tCreator = useTranslations("admin.creator.verify");
  const locale = useLocale();
  const headingId = useId();
  return (
    <article aria-labelledby={headingId} className="grid min-w-0 grid-cols-1 gap-4 rounded-lg border border-line bg-surface p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2 id={headingId} className="text-title break-words rtl:tracking-normal">
            <bdi>{request.name}</bdi>
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-fg-secondary">
            <CustomerLink id={request.customerId} username={request.username} />
            <span>{t("invites", { count: request.invites })}</span>
            <span>{t("requested", { date: date(request.at, locale) })}</span>
          </p>
        </div>
        {request.verified ? (
          <Badge size="sm" tone="primary">
            <Icon icon={BadgeCheck} size="sm" />
            {tCustomer("verified")}
          </Badge>
        ) : null}
      </div>
      {request.note ? (
        <div className="grid gap-1">
          <p className="text-caption text-fg-tertiary">{t("note")}</p>
          <p dir="auto" className="text-small break-words whitespace-pre-line">
            {request.note}
          </p>
        </div>
      ) : null}
      <div className="grid gap-1">
        <p className="text-caption text-fg-tertiary">{t("links")}</p>
        <ProfileLinks links={request.links} />
      </div>
      {canVerify && !own ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={BadgeCheck} onClick={onApprove} aria-describedby={headingId}>
            {t("approve")}
          </Button>
          <Button icon={X} onClick={onDecline} aria-describedby={headingId}>
            {t("decline")}
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-small text-fg-secondary">
          <Icon icon={Lock} size="sm" className="shrink-0" />
          {own ? t("ownRequest") : tCreator("locked")}
        </p>
      )}
    </article>
  );
}

function DecidedList({ requests }: { requests: QueueVerification[] }) {
  const t = useTranslations("admin.referrals");
  const locale = useLocale();
  return (
    <Panel title={t.markup("verifications.decided", { bdi: isolate })} id="decided-title">
      <ul className="grid grid-cols-1 gap-2">
        {requests.map((request) => (
          <li key={request.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border border-line p-3">
            <span className="grid min-w-0 gap-0.5">
              <span className="text-small font-medium break-words">
                <bdi>{request.name}</bdi>
              </span>
              <span className="flex flex-wrap items-center gap-x-2 text-caption text-fg-secondary">
                <CustomerLink id={request.customerId} username={request.username} />
                {request.decidedAt ? <span>{date(request.decidedAt, locale)}</span> : null}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {request.state === "declined" && request.declineReason ? (
                <span className="text-caption text-fg-secondary">{t.rich(`declineReasons.${request.declineReason}`, { bdi })}</span>
              ) : null}
              <Badge size="sm" tone={request.state === "approved" ? "success" : "neutral"}>
                {request.state === "approved" ? t("verifications.approved") : t("verifications.declined")}
              </Badge>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function HeldRow({ invite, canManage, onDecide }: { invite: HeldInvite; canManage: boolean; onDecide: (next: "qualified" | "revoked") => void }) {
  const t = useTranslations("admin.referrals");
  const tInvites = useTranslations("admin.customer.invites");
  const locale = useLocale();
  const reason = useReasonLabel();
  return (
    <li className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="grid min-w-0 gap-2">
        <p className="flex flex-wrap items-center gap-2 text-body">
          <CustomerLink id={invite.inviterId} username={invite.inviter} />
          <Icon icon={ArrowRight} size="sm" className="shrink-0 text-fg-tertiary" />
          <CustomerLink id={invite.inviteeId} username={invite.invitee} />
        </p>
        <p className="text-small text-fg-secondary">{reason(invite.reason)}</p>
        <SignalChips signals={invite.signals} />
        <p className="text-caption text-fg-tertiary">
          {tInvites("counted")}: {count(invite.counted, locale)} · {date(invite.at, locale)}
        </p>
      </div>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={UserCheck} onClick={() => onDecide("qualified")}>
            {t("held.release")}
          </Button>
          <Button size="sm" variant="destructive" icon={UserX} onClick={() => onDecide("revoked")}>
            {t("held.reject")}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

type Pane = "verifications" | "held";
type Pending =
  | { kind: "approve"; request: QueueVerification }
  | { kind: "decline"; request: QueueVerification }
  | { kind: "qualified"; invite: HeldInvite }
  | { kind: "revoked"; invite: HeldInvite }
  | null;

/** `/admin/referrals`: verification requests (oldest first) and held invites, each with its decision. */
export function ReferralsScreen() {
  const t = useTranslations("admin.referrals");
  const tCustomer = useTranslations("admin.customer");
  const tRetry = useTranslations("app.invite");
  const { can, me } = useAdmin();
  const account = useAccount();
  const selfId = account.status === "signedIn" ? account.account.id : null;
  const referrals = useReferralQueue();
  const { status, queue } = referrals;
  const reasonLabel = useReasonLabel();
  const [pane, setPane] = useState<Pane>("verifications");
  const [pending, setPending] = useState<Pending>(null);
  const [declineReason, setDeclineReason] = useState<DeclineReason>("profileNotLinked");
  const [why, setWhy] = useState("");

  const open = queue.verifications.filter((request) => request.state === "requested").sort((a, b) => a.at.localeCompare(b.at));
  const decided = queue.verifications
    .filter((request) => request.state !== "requested")
    .sort((a, b) => (b.decidedAt ?? b.at).localeCompare(a.decidedAt ?? a.at));
  const held = [...queue.held].sort((a, b) => a.at.localeCompare(b.at));

  const close = () => {
    setPending(null);
    setWhy("");
    setDeclineReason("profileNotLinked");
  };
  const report = (worked: boolean, message: string) =>
    toast(worked ? { title: message, tone: "success" } : { title: tCustomer("toast.failed"), tone: "danger" });

  const confirm = () => {
    if (!pending) return;
    if (pending.kind === "approve" || pending.kind === "decline") {
      const { request } = pending;
      const decision = pending.kind;
      void referralTeam
        .review({
          requestId: request.id,
          customerId: request.customerId,
          target: request.username,
          actor: me.email,
          decision,
          ...(decision === "decline" ? { reason: declineReason } : {}),
        })
        .then((worked) => report(worked, decision === "approve" ? tCustomer("toast.verified") : t("verifications.declined")));
    } else {
      const { invite } = pending;
      const next = pending.kind;
      const reason = why.trim();
      void referralTeam
        .setReferral({ id: invite.id, next, actor: me.email, target: invite.inviter, ...(reason ? { why: reason } : {}) })
        .then((worked) => report(worked, tCustomer(`invites.state.${next}`)));
    }
    close();
  };

  const dialog = (() => {
    if (!pending) return null;
    if (pending.kind === "approve") {
      return {
        title: t("verifications.approveTitle"),
        description: (
          <span className="grid gap-1">
            <span>{t("verifications.approveBody")}</span>
            <span className="text-fg">
              <bdi>{pending.request.name}</bdi> · <span dir="ltr">@{pending.request.username}</span>
            </span>
          </span>
        ),
        label: t("verifications.approve"),
        destructive: false,
      };
    }
    if (pending.kind === "decline") {
      return {
        title: t("verifications.declineTitle"),
        description: (
          <span>
            <bdi>{pending.request.name}</bdi> · <span dir="ltr">@{pending.request.username}</span>
          </span>
        ),
        label: bare(t("verifications.decline")),
        destructive: true,
      };
    }
    return {
      title: pending.kind === "qualified" ? t("held.release") : t("held.reject"),
      description: (
        <span className="grid gap-1">
          <span className="inline-flex flex-wrap items-center gap-1 text-fg">
            <span dir="ltr">@{pending.invite.inviter}</span>
            <Icon icon={ArrowRight} size="sm" />
            <span dir="ltr">{pending.invite.invitee ? `@${pending.invite.invitee}` : tCustomer("invites.none")}</span>
          </span>
          <span>{reasonLabel(pending.invite.reason)}</span>
        </span>
      ),
      label: pending.kind === "qualified" ? t("held.release") : t("held.reject"),
      destructive: pending.kind === "revoked",
    };
  })();

  return (
    <Screen title={t("title")} lead={t.rich("lead", { bdi })} wide>
      <Segmented
        label={t("title")}
        value={pane}
        onValueChange={setPane}
        className={cn("justify-self-start", touchSegmented)}
        options={[
          { value: "verifications", label: t("tabs.verifications", { count: open.length }) },
          { value: "held", label: t("tabs.held", { count: held.length }) },
        ]}
      />

      {status === "loading" ? (
        <p role="status" className="flex items-center gap-2 text-small text-fg-secondary">
          <Spinner />
          {tCustomer("loading")}
        </p>
      ) : status === "error" ? (
        <div role="alert" className="grid justify-items-start gap-3 rounded-xl border border-line bg-surface p-4">
          <p className="text-body text-fg-secondary">{tCustomer("toast.failed")}</p>
          <Button onClick={() => referrals.reload()}>{tRetry("retry")}</Button>
        </div>
      ) : pane === "verifications" ? (
        <>
          {open.length === 0 ? (
            <Empty icon={BadgeCheck} text={t("verifications.empty")} />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {open.map((request) => (
                <VerificationCard
                  key={request.id}
                  request={request}
                  canVerify={can("creators.verify")}
                  own={selfId !== null && request.customerId === selfId}
                  onApprove={() => setPending({ kind: "approve", request })}
                  onDecline={() => setPending({ kind: "decline", request })}
                />
              ))}
            </div>
          )}
          {decided.length ? <DecidedList requests={decided} /> : null}
        </>
      ) : held.length === 0 ? (
        <Empty icon={SearchCheck} text={t("held.empty")} />
      ) : (
        <ul className="grid grid-cols-1 gap-2" aria-label={t("tabs.held", { count: held.length })}>
          {held.map((invite) => (
            <HeldRow key={invite.id} invite={invite} canManage={can("customers.manage")} onDecide={(next) => setPending({ kind: next, invite })} />
          ))}
        </ul>
      )}

      {dialog && pending ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          title={dialog.title}
          description={dialog.description}
          confirmLabel={dialog.label}
          cancelLabel={tCustomer("confirm.keep")}
          destructive={dialog.destructive}
          initialFocus={pending.kind === "approve" ? "cancel" : "first-field"}
          onConfirm={confirm}
        >
          {pending.kind === "decline" ? (
            <SelectField
              label={t("verifications.reason")}
              value={declineReason}
              onValue={setDeclineReason}
              options={DECLINE_REASONS.map((value) => ({ value, label: t.markup(`declineReasons.${value}`, { bdi: isolate }) }))}
            />
          ) : pending.kind === "qualified" || pending.kind === "revoked" ? (
            <TextArea label={t("held.why")} value={why} onValue={setWhy} max={WHY_MAX} rows={2} />
          ) : null}
        </ConfirmDialog>
      ) : null}
    </Screen>
  );
}
