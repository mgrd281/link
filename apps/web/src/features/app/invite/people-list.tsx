"use client";

import { Avatar, Badge, Button, Skeleton, type BadgeProps } from "@linkyo/ui";
import { UserRound, UserX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { InvitedPerson, InviteStatus } from "@/features/referrals/types";

import { ListGroup, ListRow } from "../list";
import { NAV_ANCHORS } from "../routes";

/** How many people show before "Show all". */
const FIRST = 20;

const TONES: Record<InviteStatus, NonNullable<BadgeProps["tone"]>> = {
  counted: "success",
  pending: "neutral",
  checking: "warning",
  notCounted: "outline",
};

/**
 * The people who signed up with the creator's link, newest first: their page name (never an email),
 * the day, and whether they count. Badges carry words, so colour is never the only signal. With no
 * one yet, one honest row says so: there are never sample people. `people` is null while loading.
 */
export function PeopleList({ people }: { people: readonly InvitedPerson[] | null }) {
  const t = useTranslations("app.invite.people");
  const locale = useLocale();
  const [all, setAll] = useState(false);
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const shown = people && !all ? people.slice(0, FIRST) : people;

  return (
    <ListGroup title={t("title")} titleId={NAV_ANCHORS.invitePeople}>
      {people === null ? (
        <li className="flex min-h-control-lg items-center gap-4 px-4 py-2">
          <Skeleton className="size-avatar-sm shrink-0 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </li>
      ) : people.length === 0 ? (
        <ListRow title={<span className="text-small font-regular text-fg-secondary">{t("empty")}</span>} />
      ) : (
        <>
          {shown?.map((person) => (
            <ListRow
              key={person.id}
              {...(person.deleted ? { icon: UserX } : person.name ? { leading: <Avatar name={person.name} size="sm" /> } : { icon: UserRound })}
              title={person.deleted ? t("deleted") : person.name ? <bdi>{person.name}</bdi> : t("newMember")}
              subtitle={day.format(new Date(person.at))}
              value={
                <Badge size="sm" tone={TONES[person.status]}>
                  {t(`status.${person.status}`)}
                </Badge>
              }
            />
          ))}
          {!all && people.length > FIRST ? (
            <li className="px-4 py-3">
              <Button
                variant="tinted"
                className="pointer-coarse:h-control-lg"
                onClick={() => {
                  setAll(true);
                  // The button goes away: the group's title keeps the place in the page.
                  document.getElementById(NAV_ANCHORS.invitePeople)?.focus({ preventScroll: true });
                }}
              >
                {t("showAll", { count: people.length })}
              </Button>
            </li>
          ) : null}
        </>
      )}
    </ListGroup>
  );
}
