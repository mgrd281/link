"use client";

import { Skeleton } from "@linkyo/ui";
import { BadgeCheck, Infinity as InfinityIcon, UserRound, UserX } from "lucide-react";
import { useTranslations } from "next-intl";

import { REFERRAL_RULES } from "@/features/referrals/rules";
import { useReferrals } from "@/features/referrals/use-referrals";

import { ListGroup, ListRow } from "../list";
import { Panel, Screen } from "../screen";

/*
 * STUB of the Invite screen (`/app/invite`), until the real one replaces it. It holds the four
 * sections the section panel jumps to; each title carries its id and takes focus (`tabIndex={-1}`,
 * no outline, like the h1). It shows only what is true without sample data: the rules, the rewards'
 * names and the people the store reports.
 */

export function InviteScreen() {
  const t = useTranslations("app.invite");
  const referrals = useReferrals();

  return (
    <Screen title={t("title")} lead={t("lead")}>
      <section aria-labelledby="invite-link" className="grid grid-cols-1 gap-4 rounded-lg bg-group p-4 lg:border lg:border-line lg:p-6">
        <p id="invite-link" tabIndex={-1} className="text-caption font-semibold text-fg-secondary outline-none">
          {t("link.eyebrow")}
        </p>
        <p className="text-small font-regular text-fg-secondary">{t("rules.share")}</p>
      </section>

      <ListGroup title={t("rewards.title")} titleId="invite-rewards" footer={t("rewards.footer")}>
        <ListRow icon={BadgeCheck} title={t("rewards.verification.title")} />
        <ListRow icon={InfinityIcon} title={t("rewards.pro.title")} />
      </ListGroup>

      <ListGroup title={t("people.title")} titleId="invite-people">
        {referrals.status === "loading" ? (
          <li className="flex min-h-control-lg items-center px-4 py-2">
            <Skeleton className="h-3 w-32" />
          </li>
        ) : referrals.status === "error" && !referrals.data ? (
          <ListRow title={t("loadError")} />
        ) : referrals.data && referrals.data.invited.length > 0 ? (
          referrals.data.invited.map((person) => (
            <ListRow
              key={person.id}
              icon={person.deleted ? UserX : UserRound}
              title={person.deleted ? t("people.deleted") : person.name ? <bdi>{person.name}</bdi> : t("people.newMember")}
              value={t(`people.status.${person.status}`)}
            />
          ))
        ) : (
          <ListRow title={t("people.empty")} />
        )}
      </ListGroup>

      <Panel>
        <h2 id="invite-rules" tabIndex={-1} className="text-title outline-none rtl:tracking-normal">
          {t("rules.title")}
        </h2>
        <ol className="grid list-decimal gap-2 ps-5 text-small font-regular text-fg-secondary marker:text-fg-tertiary">
          <li>{t("rules.share")}</li>
          <li>{t("rules.once")}</li>
          <li>{t("rules.notCounted")}</li>
          <li>{t("rules.deleted")}</li>
          <li>{t("rules.verify", { count: REFERRAL_RULES.verificationAt })}</li>
          <li>{t("rules.pro", { count: REFERRAL_RULES.proForLifeAt })}</li>
        </ol>
      </Panel>
    </Screen>
  );
}
