"use client";

import { cn, Icon, Segmented } from "@linkyo/ui";
import {
  Ban,
  BadgeCheck,
  CalendarPlus,
  CircleCheck,
  CreditCard,
  Download,
  FilePen,
  FilePlus2,
  FileX2,
  Gift,
  History,
  Languages,
  LogOut,
  Mail,
  NotebookPen,
  Power,
  PowerOff,
  ReceiptText,
  Send,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Undo2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Screen } from "@/features/app/screen";
import { useNow } from "@/features/directions/poster/live";
import { touchSegmented } from "@/lib/touch";

import { timeAgo } from "./format";
import { bdi } from "./bidi";
import { useAdmin } from "./session";
import type { ActivityEvent } from "./types";

const ICONS: Record<ActivityEvent["action"], LucideIcon> = {
  "team.setup": ShieldCheck,
  "member.add": UserPlus,
  "member.role": ShieldCheck,
  "member.remove": UserMinus,
  "page.create": FilePlus2,
  "page.copy": FilePlus2,
  "page.edit": FilePen,
  "page.verify": BadgeCheck,
  "page.unverify": BadgeCheck,
  "page.ready": CircleCheck,
  "page.draft": FilePen,
  "page.export": Download,
  "page.delete": FileX2,
  "page.language": Languages,
  "invite.add": Mail,
  "invite.remove": Mail,
  "customer.plan": CreditCard,
  "customer.trial": CalendarPlus,
  "customer.cancel": CreditCard,
  "customer.resume": CreditCard,
  "customer.refund": ReceiptText,
  "customer.suspend": UserX,
  "customer.unsuspend": UserCheck,
  "customer.verify": BadgeCheck,
  "customer.unverify": BadgeCheck,
  "customer.signout": LogOut,
  "customer.note": NotebookPen,
  "customer.delete": Trash2,
  "customer.export": Download,
  "ip.block": Ban,
  "ip.unblock": ShieldOff,
  "referral.release": UserPlus,
  "referral.revoke": UserPlus,
  "referral.restore": UserPlus,
  "reward.verification": Gift,
  "reward.pro": Gift,
  "reward.revoke": Gift,
  "reward.restore": Gift,
  "verification.request": BadgeCheck,
  "verification.approve": BadgeCheck,
  "verification.decline": BadgeCheck,
  "order.assign": UserCheck,
  "order.proposal": FilePen,
  "order.deliver": Send,
  "order.refund": ReceiptText,
  "withdrawal.accepted": Undo2,
  "withdrawal.rejected": Undo2,
  "withdrawal.handled": CircleCheck,
  "cancellation.scheduled": FileX2,
  "cancellation.ended": FileX2,
  "cancellation.rejected": FileX2,
  "cancellation.resumed": CircleCheck,
  "cancellation.handled": CircleCheck,
  "ai.enabled": Power,
  "ai.disabled": PowerOff,
};

/** Real accounts read actions straight from the database, which may know names this build does not. */
const iconFor = (action: string): LucideIcon => (ICONS as Partial<Record<string, LucideIcon>>)[action] ?? History;

/** About one customer (their account, money or invite program), not a page the team prepares. */
export const isCustomerEvent = (action: ActivityEvent["action"]) => /^(customer|ip|referral|reward|verification|order|withdrawal|cancellation)\./.test(action);

type Filter = "all" | "customers" | "pages" | "team";
const inFilter = (event: ActivityEvent, filter: Filter) => {
  if (filter === "all") return true;
  if (filter === "team") return event.action.startsWith("team.") || event.action.startsWith("member.");
  if (filter === "customers") return isCustomerEvent(event.action);
  return event.action.startsWith("page.") || event.action.startsWith("invite.");
};

/** One sentence per change, newest first, grouped by day: who did what to which page. */
export function ActivityList({ events, now }: { events: ActivityEvent[]; now: number | null }) {
  const t = useTranslations("admin.activity");
  const locale = useLocale();
  const { db } = useAdmin();
  const who = (email: string) => db.members.find((member) => member.email === email)?.name ?? email;
  // The database may write an action this build has no sentence for yet: show its raw name, never crash.
  const describe = (event: ActivityEvent) => {
    const key = `actions.${event.action.replace(".", "_")}`;
    return t.has(key) ? t.rich(key, { actor: who(event.actor), target: event.target, bdi }) : `${who(event.actor)} · ${event.action} · ${event.target}`;
  };
  return (
    <ol className="grid grid-cols-1 gap-1">
      {events.map((event) => (
        <li key={event.id} className="flex min-w-0 items-start gap-3 rounded-md px-1 py-2">
          <span className="grid size-control-md shrink-0 place-items-center rounded-full bg-canvas-muted text-fg-secondary">
            <Icon icon={iconFor(event.action)} size="sm" />
          </span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="text-small">{describe(event)}</span>
            <time dateTime={event.at} className="text-caption text-fg-tertiary">
              {now === null ? "" : timeAgo(event.at, now, locale)}
            </time>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ActivityScreen() {
  const t = useTranslations("admin.activity");
  const locale = useLocale();
  const { db } = useAdmin();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("all");
  const events = db.activity.filter((event) => inFilter(event, filter));
  const day = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const groups = events.reduce<{ key: string; label: string; events: ActivityEvent[] }[]>((all, event) => {
    const label = day.format(new Date(event.at));
    const last = all.at(-1);
    if (last?.label === label) last.events.push(event);
    else all.push({ key: event.id, label, events: [event] });
    return all;
  }, []);

  return (
    <Screen title={t("title")} lead={t("lead")} wide>
      <Segmented
        label={t("filter")}
        value={filter}
        onValueChange={setFilter}
        className={cn("justify-self-start", touchSegmented)}
        options={(["all", "customers", "pages", "team"] as const).map((value) => ({ value, label: t(`filters.${value}`) }))}
      />
      {groups.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-xl border border-dashed border-line-strong p-8 text-center">
          <Icon icon={History} size="lg" className="text-fg-tertiary" />
          <p className="text-body text-fg-secondary">{t("empty")}</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.label} className="grid grid-cols-1 gap-2 rounded-xl border border-line bg-surface p-4">
            <h2 className="text-small font-semibold text-fg-secondary">{group.label}</h2>
            <ActivityList events={group.events} now={now} />
          </section>
        ))
      )}
      <p className="text-caption text-fg-tertiary">{t.rich("note", { bdi })}</p>
    </Screen>
  );
}
