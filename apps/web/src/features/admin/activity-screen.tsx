"use client";

import { Icon, Segmented } from "@linkyo/ui";
import { BadgeCheck, CircleCheck, Download, FilePen, FilePlus2, FileX2, History, Languages, Mail, ShieldCheck, UserMinus, UserPlus, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Screen } from "@/features/app/screen";
import { useNow } from "@/features/directions/poster/live";

import { timeAgo } from "./format";
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
};

type Filter = "all" | "pages" | "team";
const inFilter = (event: ActivityEvent, filter: Filter) =>
  filter === "all" || (filter === "team" ? event.action.startsWith("team.") || event.action.startsWith("member.") : event.action.startsWith("page.") || event.action.startsWith("invite."));

/** One sentence per change, newest first, grouped by day: who did what to which page. */
export function ActivityList({ events, now }: { events: ActivityEvent[]; now: number | null }) {
  const t = useTranslations("admin.activity");
  const locale = useLocale();
  const { db } = useAdmin();
  const who = (email: string) => db.members.find((member) => member.email === email)?.name ?? email;
  return (
    <ol className="grid grid-cols-1 gap-1">
      {events.map((event) => (
        <li key={event.id} className="flex min-w-0 items-start gap-3 rounded-md px-1 py-2">
          <span className="grid size-control-md shrink-0 place-items-center rounded-full bg-canvas-muted text-fg-secondary">
            <Icon icon={ICONS[event.action]} size="sm" />
          </span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="text-small">{t(`actions.${event.action.replace(".", "_")}`, { actor: who(event.actor), target: event.target })}</span>
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
        className="justify-self-start"
        options={(["all", "pages", "team"] as const).map((value) => ({ value, label: t(`filters.${value}`) }))}
      />
      {groups.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-xl border border-dashed border-line-strong p-8 text-center">
          <Icon icon={History} size="lg" className="text-fg-tertiary" />
          <p className="text-body text-fg-secondary">{t("empty")}</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.label} className="grid grid-cols-1 gap-2 rounded-xl border border-line bg-surface p-4 shadow-e1">
            <h2 className="text-small font-semibold text-fg-secondary">{group.label}</h2>
            <ActivityList events={group.events} now={now} />
          </section>
        ))
      )}
      <p className="text-caption text-fg-tertiary">{t("note")}</p>
    </Screen>
  );
}
