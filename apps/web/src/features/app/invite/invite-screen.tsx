"use client";

import { Button } from "@linkyo/ui";
import { BadgeCheck, Infinity as InfinityIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { accountStore } from "@/features/account/store";
import { PRO_AVAILABLE, REFERRAL_RULES, remaining } from "@/features/referrals/rules";
import type { DeclineReason, ReferralOverview } from "@/features/referrals/types";
import { useReferrals } from "@/features/referrals/use-referrals";
import { paymentsEnabled } from "@/lib/flags";

import { Disclosure } from "../disclosure";
import { ListGroup } from "../list";
import { NAV_ANCHORS } from "../routes";
import { Panel, Screen } from "../screen";
import { useSite } from "../site-context";

import { InviteLinkCard } from "./invite-link-card";
import { MilestoneRow, MilestoneRowSkeleton, type MilestoneProgress } from "./milestone-row";
import { PeopleList } from "./people-list";
import { VerificationSheet } from "./verification-sheet";

/*
 * Invite friends (`/app/invite`, ADR 0064): the creator's invite link, the two rewards and how far
 * each is, the people who came through the link, and the rules. Everything shown is the creator's
 * own program as the store reports it: never sample people, never a reward that isn't theirs. Pro
 * does not exist yet, so Pro for life reads as reserved until `PRO_AVAILABLE` flips.
 *
 * The four titles the section panel jumps to (link, rewards, people, rules) are there in every state,
 * also while the program loads, so a panel item always finds its target.
 */

/** The verification row's title: focus comes back here once a sent request took its button away. */
const VERIFICATION_TITLE = "invite-verification-title";

/** Stands in for a name while a message is formatted (messages take plain values). */
const NAME_SLOT = "\u0000";

/** A message around a name, the name in <bdi> so it keeps its own direction (an Arabic name in English text, and back). */
function WithName({ message, name }: { message: (slot: string) => string; name: string }) {
  const [before = "", after = ""] = message(NAME_SLOT).split(NAME_SLOT);
  return (
    <>
      {before}
      <bdi>{name}</bdi>
      {after}
    </>
  );
}

/**
 * Once the sheet has closed, focus `id`: the button that opened the sheet goes away with the request
 * sent, so the sheet's own hand-back would land on the screen's top. The sheet hands focus back in a
 * task of its own once it is gone (Radix FocusScope, `setTimeout(0)`), so this goes after it.
 */
function focusAfterSheet(id: string) {
  let frames = 0;
  const step = () => {
    frames += 1;
    if (document.querySelector('[role="dialog"]') && frames < 120) {
      window.requestAnimationFrame(step);
      return;
    }
    window.setTimeout(() => document.getElementById(id)?.focus({ preventScroll: true }), 0);
  };
  window.requestAnimationFrame(step);
}

export function InviteScreen() {
  const t = useTranslations("app.invite");
  const referrals = useReferrals();
  const { status, data } = referrals;
  const reload = () => {
    referrals.reload();
  };
  const { doc, account } = useSite();
  const [sheetOpen, setSheetOpen] = useState(false);

  // A signed-in creator always has a program; no answer at all is an error, like a failed load.
  const failed = status === "error" || (status === "ready" && !data);
  const error = failed ? (
    <div className="grid justify-items-start gap-3">
      <p className="text-small font-regular text-fg-secondary">{t("loadError")}</p>
      <Button variant="tinted" className="pointer-coarse:h-control-lg" onClick={reload}>
        {t("retry")}
      </Button>
    </div>
  ) : null;

  const lead = (
    <>
      <p>{t("lead")}</p>
      {accountStore.demo ? <p className="mt-2">{t("demoNote")}</p> : null}
    </>
  );

  return (
    <Screen title={t("title")} lead={lead} wide>
      {/* Laptops: two columns once the column has room for them (CSS columns keep the phone's order):
          the link and the rewards, then the people and the rules. */}
      <div className="@container">
        <div className="-mb-6 *:mb-6 *:break-inside-avoid @column-wide:columns-2 @column-wide:gap-6">
      <InviteLinkCard code={data?.code ?? null} error={data ? undefined : error} />

      <ListGroup
        title={t("rewards.title")}
        titleId={NAV_ANCHORS.inviteRewards}
        trailing={data ? <span className="text-caption tabular-nums text-fg-secondary">{t("rewards.counted", { count: data.counted })}</span> : null}
        footer={t("rewards.footer")}
      >
        {data ? (
          <Rewards data={data} verified={doc.profile.verified} onRequest={() => setSheetOpen(true)} />
        ) : failed ? (
          <LockedRewards />
        ) : (
          <>
            <MilestoneRowSkeleton />
            <MilestoneRowSkeleton />
          </>
        )}
      </ListGroup>

      <div className="grid gap-6 @column-wide:break-before-column">
        {/* With an error the screen says so once, in the card; the people are simply not listed. */}
        {failed && !data ? null : <PeopleList people={data?.invited ?? null} />}
        <Rules />
      </div>

      {data?.invitedBy ? (
        <p className="text-small font-regular text-fg-secondary">
          <WithName message={(name) => t("invitedBy", { name })} name={data.invitedBy.name} />
        </p>
      ) : null}
        </div>
      </div>

      {data ? (
        <VerificationSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          username={account.username}
          retryAt={data.verification?.retryAt ?? null}
          onSent={() => {
            reload();
            focusAfterSheet(VERIFICATION_TITLE);
          }}
        />
      ) : null}
    </Screen>
  );
}

/** What each verification state says and offers; the first state that applies wins. */
type VerificationView =
  | { kind: "verified" }
  | { kind: "removed" }
  | { kind: "locked" }
  | { kind: "ready" }
  | { kind: "requested"; at: string }
  | { kind: "declined"; reason: DeclineReason; retryAt: string | null; canRetry: boolean };

function verificationView(data: ReferralOverview, verified: boolean, now: number): VerificationView {
  const reward = data.rewards.verification_review;
  const request = data.verification;
  if (verified) return { kind: "verified" };
  if (reward?.revoked) return { kind: "removed" };
  if (!reward) return { kind: "locked" };
  if (!request) return { kind: "ready" };
  if (request.state === "requested") return { kind: "requested", at: request.at };
  if (request.state === "declined") {
    const retryAt = request.retryAt;
    return { kind: "declined", reason: request.declineReason ?? "other", retryAt, canRetry: retryAt === null || Date.parse(retryAt) <= now };
  }
  // Approved, but the page is not verified (any more): the team took the check away later.
  return { kind: "ready" };
}

function Rewards({ data, verified, onRequest }: { data: ReferralOverview; verified: boolean; onRequest: () => void }) {
  const t = useTranslations("app.invite.rewards");
  const tReasons = useTranslations("app.invite.declineReasons");
  const locale = useLocale();
  const [now] = useState(() => Date.now());
  const date = (iso: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(iso));
  const progress = (at: number): MilestoneProgress => {
    const left = remaining(data.counted, at);
    return {
      value: Math.min(data.counted, at),
      max: at,
      valueText: t("progress", { done: Math.min(data.counted, at), total: at }),
      remaining: left > 0 ? t("more", { count: left }) : undefined,
    };
  };

  const view = verificationView(data, verified, now);
  const request = (label: string) => (
    <Button variant="tinted" size="md" className="pointer-coarse:h-control-lg" onClick={onRequest}>
      {label}
    </Button>
  );
  let status: ReactNode;
  let action: ReactNode = null;
  switch (view.kind) {
    case "verified":
      status = t("verification.verified");
      break;
    case "removed":
      status = t("removed");
      break;
    case "locked":
      status = t("verification.locked", { count: REFERRAL_RULES.verificationAt });
      break;
    case "ready":
      status = t("verification.ready");
      action = request(t("verification.request"));
      break;
    case "requested":
      status = t("verification.requested", { date: date(view.at) });
      break;
    case "declined":
      status = (
        <>
          {t("verification.declined", { reason: tReasons(view.reason) })}
          {view.retryAt ? ` ${t("verification.retryAt", { date: date(view.retryAt) })}` : null}
        </>
      );
      action = view.canRetry ? request(t("verification.requestAgain")) : null;
      break;
  }

  const pro = data.rewards.pro_for_life;
  // Until Pro launches the reward is reserved ("Pro is coming soon"), never shown as a live plan.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- PRO_AVAILABLE is a constant that flips at launch
  const proYours = PRO_AVAILABLE ? t("pro.active") : t("pro.yours");
  return (
    <>
      <MilestoneRow
        icon={BadgeCheck}
        title={t("verification.title")}
        titleId={VERIFICATION_TITLE}
        status={status}
        done={view.kind === "verified"}
        progress={view.kind === "locked" ? progress(REFERRAL_RULES.verificationAt) : undefined}
        action={action}
      />
      <MilestoneRow
        icon={InfinityIcon}
        title={t("pro.title")}
        status={pro?.revoked ? t("removed") : pro ? proYours : t("pro.locked", { count: REFERRAL_RULES.proForLifeAt })}
        done={Boolean(pro && !pro.revoked)}
        progress={pro ? undefined : progress(REFERRAL_RULES.proForLifeAt)}
      />
    </>
  );
}

/** Without the program (it did not load): the two rewards and what unlocks them, which hold for everyone. */
function LockedRewards() {
  const t = useTranslations("app.invite.rewards");
  return (
    <>
      <MilestoneRow icon={BadgeCheck} title={t("verification.title")} status={t("verification.locked", { count: REFERRAL_RULES.verificationAt })} />
      <MilestoneRow icon={InfinityIcon} title={t("pro.title")} status={t("pro.locked", { count: REFERRAL_RULES.proForLifeAt })} />
    </>
  );
}

function Rules() {
  const t = useTranslations("app.invite");
  return (
    <Panel title={t("rules.title")} id={NAV_ANCHORS.inviteRules} className="scroll-mt-16">
      <ol className="grid list-decimal gap-2 ps-5 text-small font-regular text-fg-secondary marker:text-fg-tertiary">
        <li>{t("rules.share")}</li>
        <li>{t("rules.once")}</li>
        <li>{t("rules.notCounted")}</li>
        <li>{t("rules.deleted")}</li>
        <li>{t("rules.verify", { count: REFERRAL_RULES.verificationAt })}</li>
        {/* Where Pro can be bought, it exists: the reward line says what it includes. */}
        <li>{t(paymentsEnabled ? "rules.proLive" : "rules.pro", { count: REFERRAL_RULES.proForLifeAt })}</li>
      </ol>
      <Disclosure summary={t("rules.terms")}>
        <div className="grid gap-2 pt-1 text-small font-regular text-fg-secondary">
          <p>{t("terms.personal")}</p>
          <p>{t("terms.review", { days: REFERRAL_RULES.retryVerificationDays })}</p>
          <p>{t("terms.abuse")}</p>
          <p>{t("terms.ads")}</p>
          <p>{t("terms.changes")}</p>
        </div>
      </Disclosure>
    </Panel>
  );
}
